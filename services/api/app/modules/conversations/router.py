import re
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.logging import get_logger
from app.core.middleware.rate_limit import enforce_conversation_rate_limit
from app.core.redis import get_redis_client
from app.core.security import AuthContext
from app.domain.entities.conversation import ConversationChannel, MessageRole
from app.domain.entities.product import Product
from app.modules.ai.dependencies import get_ai_orchestrator
from app.modules.ai.orchestrator import AIOrchestrator
from app.modules.ai.prompts import format_known_preferences
from app.modules.catalog.dependencies import get_catalog_service_for_customer
from app.modules.catalog.service import CatalogService
from app.modules.conversations.dependencies import (
    get_conversation_service_for_customer,
    get_conversation_service_for_store,
)
from app.modules.conversations.reply_composer import compose_greeting
from app.modules.conversations.schemas import (
    ConversationMessageRead,
    ConversationRead,
    ConversationStartResponse,
    MessageExchangeRead,
    PostMessageRequest,
)
from app.modules.conversations.service import ConversationService
from app.modules.search.dependencies import get_search_service_for_customer
from app.modules.search.normalization import detect_language
from app.modules.search.service import SearchService
from app.modules.tenants.dependencies import get_tenant_service_for_customer
from app.modules.tenants.schemas import TenantBranding
from app.modules.tenants.service import TenantService
from app.shared.deps import get_current_customer_auth, get_current_store_auth
from app.shared.exceptions import RateLimitExceededError
from app.shared.pagination import PageParams, page_params

logger = get_logger(__name__)

router = APIRouter(prefix="/conversations", tags=["conversations"])

# How many products a search-backed reply includes at most — kept small
# and constant rather than configurable per request, since a chat bubble
# listing 20 products is not a usable reply regardless of how many the
# search itself found.
_REPLY_PRODUCT_LIMIT = 5

# A salesperson asks a couple of questions, then shows something — they
# don't interrogate. After this many clarifying questions in a conversation,
# the next turn always searches even if the planner would still ask, so the
# customer never gets stuck in an endless Q&A loop.
_MAX_CLARIFICATIONS = 2

_FOLLOW_UP_REFERENCE = re.compile(
    r"\b(this|that|these|those|it|one|ones|ye|yeh|woh|wo|wala|wali|walay|"
    r"available|cheaper|sasta|sasti|یہ|وہ|والا|سستا)\b",
    re.IGNORECASE,
)

# Bare fallback question if the planner picks "clarify" but somehow returns
# no reply text — vanishingly rare, but the customer must still get a turn.
_FALLBACK_CLARIFY = {
    "english": "Could you tell me a little more about what you're looking for?",
    "roman_urdu": "Thora aur bata dein aap kya dhoond rahe hain?",
    "urdu": "براہ کرم تھوڑا اور بتائیں کہ آپ کیا ڈھونڈ رہے ہیں؟",
}


def _fallback_clarify(language: str) -> str:
    return _FALLBACK_CLARIFY.get(language, _FALLBACK_CLARIFY["english"])


def _extract_budget(value: object) -> float | None:
    """Parses a numeric ceiling out of a stated budget slot — "3000",
    "3000 tak", "under 5000", "5k" all yield a number. Used to filter search
    results to what the customer said they'd spend; returns None when
    there's no usable number so no filter is applied."""
    if value is None:
        return None
    text = str(value).lower().replace(",", "")
    match = re.search(r"(\d+(?:\.\d+)?)\s*(k)?", text)
    if not match:
        return None
    amount = float(match.group(1))
    if match.group(2) == "k":
        amount *= 1000
    return amount if amount > 0 else None


def _references_recent_products(text: str) -> bool:
    """Recognizes short/deictic follow-ups whose meaning comes from the
    products shown on the previous turn, not from a fresh semantic search."""
    return bool(_FOLLOW_UP_REFERENCE.search(text))


async def _load_recent_products(
    catalog_service: CatalogService,
    tenant_id: UUID,
    raw_ids: object,
) -> list[Product]:
    if not isinstance(raw_ids, list):
        return []
    products: list[Product] = []
    for raw_id in raw_ids[:_REPLY_PRODUCT_LIMIT]:
        try:
            products.append(await catalog_service.get_product(tenant_id, UUID(str(raw_id))))
        except Exception:  # noqa: BLE001 - stale/deleted context items are skipped
            continue
    return products


async def _find_alternatives(
    search_service: SearchService,
    tenant_id: UUID,
    context: dict,
    raw_query: str,
) -> list:
    """When the exact search yields nothing, find real, related products to
    honestly offer instead — a salesperson who's out of the exact item
    points you to the nearest thing they DO have, never pretends. Broadens
    progressively: the customer's category first (e.g. "shirt"), then colour
    (e.g. "black"), then the raw message — returning the first non-empty real
    result set. All still tenant-scoped, so alternatives can only ever be
    this store's own stock."""
    seen_terms: set[str] = set()
    for term in (context.get("category"), context.get("color"), raw_query):
        if not term:
            continue
        term_str = str(term).strip().lower()
        if not term_str or term_str in seen_terms:
            continue
        seen_terms.add(term_str)
        try:
            results = await search_service.search_products(
                tenant_id, str(term), top_k=_REPLY_PRODUCT_LIMIT
            )
        except Exception:  # noqa: BLE001 — an embeddings outage just means no alternatives
            results = []
        if results:
            return results
    return []


# --- Customer widget: creates and appends to its own conversation ---


@router.post("", response_model=ConversationStartResponse, status_code=201, summary="Start a conversation")
async def start_conversation(
    auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    conversation_service: Annotated[ConversationService, Depends(get_conversation_service_for_customer)],
    tenant_service: Annotated[TenantService, Depends(get_tenant_service_for_customer)],
    channel: ConversationChannel = ConversationChannel.WIDGET,
    language: str = "roman_urdu",
) -> ConversationStartResponse:
    """Creates the session and records the auto-greeting (FR: Customer AI
    Widget) in the same call — the widget shows the greeting the instant
    it opens, with no second request needed."""
    assert auth.tenant_id is not None
    conversation = await conversation_service.start_conversation(
        auth.tenant_id, channel, language, customer_id=UUID(auth.subject_id)
    )
    tenant = await tenant_service.get_tenant(auth.tenant_id)
    greeting_text = compose_greeting(language, tenant.branding.get("greeting_persona"))
    greeting = await conversation_service.record_message(
        conversation.id, MessageRole.ASSISTANT, greeting_text
    )
    return ConversationStartResponse(
        conversation=ConversationRead.model_validate(conversation),
        greeting=ConversationMessageRead.model_validate(greeting),
        branding=TenantBranding.model_validate(tenant.branding),
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageExchangeRead,
    status_code=201,
    summary="Send a message and get the assistant's reply",
)
async def post_message(
    conversation_id: UUID,
    payload: PostMessageRequest,
    _auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    conversation_service: Annotated[ConversationService, Depends(get_conversation_service_for_customer)],
    search_service: Annotated[SearchService, Depends(get_search_service_for_customer)],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service_for_customer)],
    tenant_service: Annotated[TenantService, Depends(get_tenant_service_for_customer)],
    ai_orchestrator: Annotated[AIOrchestrator, Depends(get_ai_orchestrator)],
) -> MessageExchangeRead:
    """Handles a turn like a salesperson, in two phases (see
    app/modules/ai/orchestrator.py):

    1. PLAN — decide whether the request is specific enough to show products
       yet, or whether one natural clarifying question (style/budget/occasion)
       would help first, and extract any preferences the customer just stated.
    2. ACT — on "clarify", reply with the question and show NO products; on
       "search", search this tenant's catalog with a query refined from ALL
       accumulated preferences, filter to the stated budget, and compose a
       grounded reply from the real results.

    Everything reuses the same AI Customer Assistant, tenant-scoped catalog
    search, and conversation context — a voice turn and a typed turn go
    through this identical path. If the AI provider is unavailable or the
    plan can't be produced, this degrades to plain always-search behaviour
    (and generate_reply's own template fallback), so the chat never 500s.

    Language is kept stable across a conversation: a short answer like
    "Casual" that detects as English won't flip an established Roman-Urdu
    chat — only a positive non-English signal switches it."""
    conversation = await conversation_service.get_conversation(conversation_id)

    if not await enforce_conversation_rate_limit(str(conversation_id), get_redis_client()):
        raise RateLimitExceededError()

    # Fetched before this turn's message is recorded, so it's exactly the
    # history the orchestrator should treat as "what came before now".
    history = await conversation_service.get_transcript(conversation_id)

    customer_message = await conversation_service.record_message(
        conversation_id, MessageRole.CUSTOMER, payload.content
    )
    await conversation_service.touch_activity(conversation_id)

    tenant = await tenant_service.get_tenant(conversation.tenant_id)
    context = conversation.context or {}

    detected = detect_language(payload.content)
    prior_language = str(context.get("language") or conversation.language or "roman_urdu")
    turn_language = detected if detected != "english" else prior_language

    clarifications_so_far = int(context.get("clarification_count", 0) or 0)
    references_recent_products = _references_recent_products(payload.content) and bool(
        context.get("last_matched_product_ids")
    )

    plan = await ai_orchestrator.plan_turn(
        store_name=tenant.name,
        language=turn_language,
        known_preferences=format_known_preferences(context),
        clarifications_so_far=clarifications_so_far,
        query=payload.content,
        history=history,
    )

    # Accumulate any newly-stated preferences so both this turn's grounded
    # reply and every later turn's planning see the full picture.
    merged_context: dict = {**context, **(plan.slots if plan else {}), "language": turn_language}

    is_clarify = (
        plan is not None and plan.action == "clarify" and clarifications_so_far < _MAX_CLARIFICATIONS
        and not references_recent_products
    )

    if is_clarify:
        # Salesperson question turn: no catalog search, no product cards —
        # an empty matched_product_ids is what tells the widget to render
        # just the question (see apps/widget attachProductResults).
        assert plan is not None  # narrowed by is_clarify
        reply_text = plan.reply or _fallback_clarify(turn_language)
        ai_generated = plan.reply is not None
        matched_product_ids: list[str] = []
        merged_context["clarification_count"] = clarifications_so_far + 1
    else:
        # Search turn. Refined query when the planner gave one, else the raw
        # message — the latter is also the path when the planner is
        # unavailable, i.e. exactly the pre-planner always-search behaviour.
        search_query = (plan.search_query if plan else None) or payload.content
        found = []
        if references_recent_products:
            found = await _load_recent_products(
                catalog_service,
                conversation.tenant_id,
                context.get("last_matched_product_ids"),
            )
        if not found:
            try:
                found = await search_service.search_products(
                    conversation.tenant_id, search_query, top_k=_REPLY_PRODUCT_LIMIT
                )
            except Exception as exc:  # noqa: BLE001 — an embeddings-provider outage (bad/missing
                # key, rate limit, network) must degrade this turn to "no products found",
                # never crash the whole chat with a 500.
                logger.warning(
                    "product_search_failed", conversation_id=str(conversation_id), error=str(exc)
                )
                found = []

        # Respect a stated budget the way a salesperson would, but honestly.
        # `found` is ranked by relevance, so found[0] is the best match for
        # what they actually asked for. If that best match is within budget,
        # show the in-budget results as a real match. If the best match is
        # OVER budget, the customer's actual request isn't affordable here —
        # don't quietly scrape together cheaper-but-irrelevant items and
        # present them as if they were what was asked; instead offer the
        # real (over-budget) options as honest alternatives ("nothing under
        # X, but we do have these from Y").
        budget = _extract_budget(merged_context.get("budget"))
        if budget is None:
            matched_products = found
            exact_match = bool(found)
        elif found and float(found[0].price) <= budget:
            matched_products = [p for p in found if float(p.price) <= budget]
            exact_match = True
        else:
            matched_products = found[:_REPLY_PRODUCT_LIMIT]
            exact_match = False

        # Truly nothing came back (not even over budget) — broaden the search
        # to this store's closest related stock so we can honestly offer a
        # real alternative rather than dead-ending.
        if not matched_products:
            matched_products = await _find_alternatives(
                search_service, conversation.tenant_id, merged_context, payload.content
            )
            exact_match = False

        matched_product_ids = [str(p.id) for p in matched_products]

        reply = await ai_orchestrator.generate_reply(
            store_name=tenant.name,
            persona=tenant.branding.get("greeting_persona"),
            language=turn_language,
            query=payload.content,
            products=matched_products,
            history=history,
            known_preferences=format_known_preferences(merged_context),
            exact_match=exact_match,
        )
        reply_text = reply.text
        ai_generated = reply.ai_generated
        # We showed products (or honestly reported none) — the clarifying
        # phase is complete; reset so a later, unrelated vague request can
        # earn fresh clarifying questions.
        merged_context["clarification_count"] = 0

    assistant_message = await conversation_service.record_message(
        conversation_id,
        MessageRole.ASSISTANT,
        reply_text,
        intent={
            "matched_product_ids": matched_product_ids,
            "query": payload.content,
            "detected_language": turn_language,
            # Whether THIS turn's reply actually came from the LLM — false
            # only when it fell back to a non-LLM template/fallback.
            "ai_generated": ai_generated,
            "action": "clarify" if is_clarify else "search",
        },
    )

    merged_context["last_query"] = payload.content
    merged_context["last_matched_product_ids"] = matched_product_ids
    await conversation_service.update_context(conversation_id, merged_context)

    return MessageExchangeRead(
        customer_message=ConversationMessageRead.model_validate(customer_message),
        assistant_message=ConversationMessageRead.model_validate(assistant_message),
    )


# --- Store dashboard: read-only transcript review (FR-2.7) ---


@router.get("", response_model=list[ConversationRead], summary="List conversations")
async def list_conversations(
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    conversation_service: Annotated[ConversationService, Depends(get_conversation_service_for_store)],
    pagination: Annotated[PageParams, Depends(page_params)],
) -> list[ConversationRead]:
    assert auth.tenant_id is not None
    conversations = await conversation_service.list_conversations(
        auth.tenant_id, limit=pagination.limit, offset=pagination.offset
    )
    return [ConversationRead.model_validate(c) for c in conversations]


@router.get(
    "/{conversation_id}/messages", response_model=list[ConversationMessageRead], summary="Get a transcript"
)
async def get_transcript(
    conversation_id: UUID,
    _auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    conversation_service: Annotated[ConversationService, Depends(get_conversation_service_for_store)],
) -> list[ConversationMessageRead]:
    messages = await conversation_service.get_transcript(conversation_id)
    return [ConversationMessageRead.model_validate(m) for m in messages]
