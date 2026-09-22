"""Generates the assistant's reply for a conversation turn using the
configured LLM, grounded in this tenant's real catalog (search results
already resolved by the caller — see app/modules/conversations/router.py)
and recent conversation history.

Falls back to the deterministic templates in
app/modules/conversations/reply_composer.py whenever the AI provider isn't
configured, or a call to it fails for any reason (timeout, auth error, rate
limit, malformed response). That fallback is what "Conversation Orchestrator
not built here" in reply_composer.py's docstring was pointing at — this
module is that orchestrator, and the MVP's original templated flow becomes
its safety net rather than being replaced.
"""

import json
from dataclasses import dataclass, field

from app.core.logging import get_logger
from app.domain.entities.conversation import ConversationMessage, MessageRole
from app.domain.entities.product import Product
from app.modules.ai.prompts import (
    SLOT_KEYS,
    build_planner_prompt,
    build_system_prompt,
    format_product_context,
)
from app.modules.ai.provider import ChatMessage, ChatProvider
from app.modules.conversations.reply_composer import compose_search_reply

logger = get_logger(__name__)

# Planning is a decision, not prose — run it colder than the reply so the
# clarify-vs-search call is stable rather than creative.
_PLANNER_TEMPERATURE = 0.2


@dataclass
class AIReply:
    text: str
    # True only when this turn's text actually came from the LLM — False
    # whenever it's the reply_composer template, whether that's because no
    # provider is configured or because a configured one failed/returned
    # empty this call. Distinct from AIOrchestrator.is_configured, which
    # only says a provider exists, not that it worked *this turn* — a
    # transcript's `ai_generated` flag should reflect what actually
    # happened, not just whether a key was present.
    ai_generated: bool


@dataclass
class TurnPlan:
    """The planner's decision for one turn (see build_planner_prompt).
    `action` is "search" or "clarify". On "clarify", `reply` holds the
    salesperson's question and no search runs. On "search", `search_query`
    is the refined phrase to search the catalog with. `slots` is the newly
    extracted preferences to merge into conversation.context either way."""

    action: str
    slots: dict[str, str] = field(default_factory=dict)
    search_query: str | None = None
    reply: str | None = None


class AIOrchestrator:
    def __init__(
        self,
        provider: ChatProvider | None,
        *,
        max_tokens: int,
        temperature: float,
        history_turns: int,
    ) -> None:
        self._provider = provider
        self._max_tokens = max_tokens
        self._temperature = temperature
        self._history_turns = history_turns

    @property
    def is_configured(self) -> bool:
        return self._provider is not None

    async def plan_turn(
        self,
        *,
        store_name: str,
        language: str,
        known_preferences: str,
        clarifications_so_far: int,
        query: str,
        history: list[ConversationMessage],
    ) -> TurnPlan | None:
        """Decides how to handle this turn like a salesperson — ask one
        clarifying question, or search now (see build_planner_prompt).
        Returns None when there's no provider or the call/parse fails, which
        the router treats as "just search with the raw message" — i.e. the
        pre-conversational-planner behaviour, so a planner outage degrades
        to a working search box rather than a broken chat."""
        if self._provider is None:
            return None

        messages = [
            ChatMessage(
                role="system",
                content=build_planner_prompt(
                    store_name=store_name,
                    language=language,
                    known_preferences=known_preferences,
                    clarifications_so_far=clarifications_so_far,
                ),
            )
        ]
        for turn in history[-self._history_turns :]:
            role = "assistant" if turn.role == MessageRole.ASSISTANT else "user"
            messages.append(ChatMessage(role=role, content=turn.content))
        messages.append(ChatMessage(role="user", content=query))

        try:
            raw = await self._provider.complete(
                messages, max_tokens=self._max_tokens, temperature=_PLANNER_TEMPERATURE
            )
        except Exception as exc:  # noqa: BLE001 — a planner failure must degrade to the
            # always-search fallback, never surface as a 500 to a shopper.
            logger.warning("ai_plan_failed", error=str(exc))
            return None

        plan = _parse_plan(raw)
        if plan is None:
            logger.warning("ai_plan_unparseable", raw=raw[:200])
        return plan

    async def generate_reply(
        self,
        *,
        store_name: str,
        persona: str | None,
        language: str,
        query: str,
        products: list[Product],
        history: list[ConversationMessage],
        known_preferences: str = "none yet",
        exact_match: bool = True,
    ) -> AIReply:
        """`history` should be the transcript BEFORE this turn's customer
        message (the router records that message first, then calls this) —
        the current query is appended separately below so it's never
        duplicated in the prompt.

        `exact_match=False` tells the reply that `products` are real
        alternatives to an unavailable request, so it frames them honestly
        (see build_system_prompt)."""
        if self._provider is None:
            return AIReply(compose_search_reply(language, query, products), ai_generated=False)

        system_prompt = build_system_prompt(
            store_name=store_name,
            persona=persona,
            language=language,
            known_preferences=known_preferences,
            exact_match=exact_match,
        )
        messages = [
            ChatMessage(
                role="system",
                content=f"{system_prompt}\n\n{format_product_context(products)}",
            )
        ]
        for turn in history[-self._history_turns :]:
            role = "assistant" if turn.role == MessageRole.ASSISTANT else "user"
            messages.append(ChatMessage(role=role, content=turn.content))
        messages.append(ChatMessage(role="user", content=query))

        try:
            reply = await self._provider.complete(
                messages, max_tokens=self._max_tokens, temperature=self._temperature
            )
            if reply:
                return AIReply(reply, ai_generated=True)
            logger.warning("ai_reply_empty", query=query)
        except Exception as exc:  # noqa: BLE001 — any provider failure degrades to the
            # template, it must never surface as a 500 to a shopper mid-chat.
            logger.warning("ai_reply_failed", error=str(exc))

        return AIReply(compose_search_reply(language, query, products), ai_generated=False)


def _parse_plan(raw: str) -> TurnPlan | None:
    """Defensively turns the planner's raw completion into a TurnPlan.
    Tolerates the model wrapping its JSON in prose or ```json fences (both
    happen despite the "JSON only" instruction) by extracting the first
    balanced-looking {...} span. Any structural surprise returns None so the
    caller falls back to always-search rather than raising."""
    if not raw:
        return None

    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    try:
        data = json.loads(raw[start : end + 1])
    except (ValueError, TypeError):
        return None
    if not isinstance(data, dict):
        return None

    action = data.get("action")
    if action not in ("search", "clarify"):
        return None

    raw_slots = data.get("slots")
    slots: dict[str, str] = {}
    if isinstance(raw_slots, dict):
        for key in SLOT_KEYS:
            value = raw_slots.get(key)
            # Coerce to a trimmed string and drop blanks / the model's
            # "null"/"none" placeholders so they never pollute accumulated
            # context or get shown back to the customer as a known preference.
            if value is None:
                continue
            text = str(value).strip()
            if text and text.lower() not in ("null", "none", "n/a"):
                slots[key] = text

    search_query = data.get("search_query")
    reply = data.get("reply")
    return TurnPlan(
        action=action,
        slots=slots,
        search_query=str(search_query).strip() if search_query else None,
        reply=str(reply).strip() if reply else None,
    )
