"""Unit tests for AIOrchestrator — a fake ChatProvider stands in for the
real OpenAI call (same pattern as the fake repositories in
test_conversation_context.py / test_tenant_service.py), so these run with
no network access and no API key."""

from decimal import Decimal
from uuid import uuid4

import pytest

from app.domain.entities.conversation import ConversationMessage, MessageRole
from app.domain.entities.product import Product, ProductStatus
from app.modules.ai.orchestrator import AIOrchestrator, _parse_plan
from app.modules.ai.prompts import build_system_prompt, format_product_context
from app.modules.ai.provider import ChatMessage, ChatProvider


class FakeChatProvider(ChatProvider):
    def __init__(self, reply: str | None = None, error: Exception | None = None) -> None:
        self.reply = reply
        self.error = error
        self.last_messages: list[ChatMessage] | None = None

    async def complete(self, messages: list[ChatMessage], *, max_tokens: int, temperature: float) -> str:
        self.last_messages = messages
        if self.error is not None:
            raise self.error
        return self.reply if self.reply is not None else ""


def _product(title: str = "Kurta", price: str = "2500") -> Product:
    return Product(
        id=uuid4(),
        tenant_id=uuid4(),
        external_id="SKU-1",
        title=title,
        price=Decimal(price),
        currency="PKR",
        stock_qty=10,
        status=ProductStatus.ACTIVE,
    )


def _orchestrator(provider: ChatProvider | None) -> AIOrchestrator:
    return AIOrchestrator(provider, max_tokens=200, temperature=0.4, history_turns=6)


async def test_falls_back_to_template_when_no_provider_configured() -> None:
    orchestrator = _orchestrator(None)
    assert orchestrator.is_configured is False

    reply = await orchestrator.generate_reply(
        store_name="Test Store",
        persona=None,
        language="english",
        query="show me shoes",
        products=[],
        history=[],
    )

    assert "couldn't find anything" in reply.text
    assert reply.ai_generated is False


async def test_uses_provider_reply_when_configured() -> None:
    provider = FakeChatProvider(reply="Yes, this kurta is in stock for PKR 2500!")
    orchestrator = _orchestrator(provider)
    assert orchestrator.is_configured is True

    reply = await orchestrator.generate_reply(
        store_name="Test Store",
        persona=None,
        language="english",
        query="do you have kurtas?",
        products=[_product()],
        history=[],
    )

    assert reply.text == "Yes, this kurta is in stock for PKR 2500!"
    assert reply.ai_generated is True


async def test_falls_back_to_template_when_provider_raises() -> None:
    provider = FakeChatProvider(error=RuntimeError("upstream timeout"))
    orchestrator = _orchestrator(provider)

    products = [_product()]
    reply = await orchestrator.generate_reply(
        store_name="Test Store",
        persona=None,
        language="english",
        query="kurta chahiye",
        products=products,
        history=[],
    )

    # The deterministic reply_composer path, not an exception surfacing —
    # and ai_generated must say so, even though a provider IS configured.
    assert "Kurta" in reply.text
    assert "2500" in reply.text
    assert reply.ai_generated is False


async def test_falls_back_to_template_when_provider_returns_empty() -> None:
    provider = FakeChatProvider(reply="")
    orchestrator = _orchestrator(provider)

    reply = await orchestrator.generate_reply(
        store_name="Test Store",
        persona=None,
        language="english",
        query="anything nice?",
        products=[],
        history=[],
    )

    assert "couldn't find anything" in reply.text
    assert reply.ai_generated is False


async def test_product_context_is_grounded_in_actual_search_results() -> None:
    """The prompt sent to the provider must only ever contain the products
    the caller passed in — this is the whole grounding guarantee, so it's
    worth asserting on the literal prompt content, not just the reply."""
    provider = FakeChatProvider(reply="Sure!")
    orchestrator = _orchestrator(provider)
    product = _product(title="Unique Product Name XYZ", price="4999")

    await orchestrator.generate_reply(
        store_name="Test Store",
        persona=None,
        language="english",
        query="tell me about this",
        products=[product],
        history=[],
    )

    system_message = provider.last_messages[0]
    assert system_message.role == "system"
    assert "Unique Product Name XYZ" in system_message.content
    assert "4999" in system_message.content


async def test_exact_match_prompt_does_not_frame_products_as_alternatives() -> None:
    """When the search matched what the customer asked for, the prompt must
    NOT tell the model to say the exact thing is unavailable."""
    provider = FakeChatProvider(reply="Here you go!")
    orchestrator = _orchestrator(provider)

    await orchestrator.generate_reply(
        store_name="Test Store",
        persona=None,
        language="english",
        query="black shirt",
        products=[_product(title="Black Shirt")],
        history=[],
        exact_match=True,
    )

    system_prompt = provider.last_messages[0].content
    assert "does NOT have the exact thing" not in system_prompt


async def test_no_exact_match_prompt_instructs_honest_alternatives() -> None:
    """When products are alternatives (exact request unavailable), the prompt
    must instruct the honest "we don't have X, but here's Y" framing — this
    is the vision's black-shirt→black-kurta behaviour."""
    provider = FakeChatProvider(reply="Sorry, no black shirts, but we have kurtas.")
    orchestrator = _orchestrator(provider)

    await orchestrator.generate_reply(
        store_name="Test Store",
        persona=None,
        language="english",
        query="black shirt",
        products=[_product(title="Black Kurta")],
        history=[],
        exact_match=False,
    )

    system_prompt = provider.last_messages[0].content
    assert "does NOT have the exact thing" in system_prompt
    assert "CLOSEST RELATED alternatives" in system_prompt
    # The real alternative is still the only product it may mention.
    assert "Black Kurta" in system_prompt


async def test_history_is_capped_to_configured_turn_count() -> None:
    provider = FakeChatProvider(reply="ok")
    orchestrator = AIOrchestrator(provider, max_tokens=200, temperature=0.4, history_turns=2)

    history = [
        ConversationMessage(
            id=uuid4(), conversation_id=uuid4(), role=MessageRole.CUSTOMER, content=f"msg {i}"
        )
        for i in range(10)
    ]

    await orchestrator.generate_reply(
        store_name="Test Store",
        persona=None,
        language="english",
        query="latest question",
        products=[],
        history=history,
    )

    # system prompt + last 2 history turns + the current query
    assert len(provider.last_messages) == 4
    assert provider.last_messages[-1].content == "latest question"


async def test_ten_spoken_exchanges_remain_in_the_configured_context_window() -> None:
    provider = FakeChatProvider(reply="ok")
    orchestrator = AIOrchestrator(provider, max_tokens=200, temperature=0.4, history_turns=20)
    conversation_id = uuid4()
    history = [
        ConversationMessage(
            id=uuid4(),
            conversation_id=conversation_id,
            role=MessageRole.CUSTOMER if index % 2 == 0 else MessageRole.ASSISTANT,
            content=f"spoken message {index + 1}",
        )
        for index in range(20)
    ]

    await orchestrator.generate_reply(
        store_name="Test Store",
        persona=None,
        language="roman_urdu",
        query="ye wala available hai?",
        products=[_product(title="Black Sneakers")],
        history=history,
    )

    assert provider.last_messages is not None
    assert len(provider.last_messages) == 22
    assert provider.last_messages[1].content == "spoken message 1"
    assert provider.last_messages[-2].content == "spoken message 20"
    assert provider.last_messages[-1].content == "ye wala available hai?"


async def test_persona_is_included_in_system_prompt_when_set() -> None:
    provider = FakeChatProvider(reply="ok")
    orchestrator = _orchestrator(provider)

    await orchestrator.generate_reply(
        store_name="Test Store",
        persona="Cheerful and casual",
        language="english",
        query="hi",
        products=[],
        history=[],
    )

    assert "Cheerful and casual" in provider.last_messages[0].content


@pytest.mark.parametrize(
    "language,expected_snippet",
    [
        ("english", "clear, friendly English"),
        ("roman_urdu", "Roman Urdu"),
        ("urdu", "Urdu script"),
    ],
)
async def test_language_instruction_matches_requested_language(
    language: str, expected_snippet: str
) -> None:
    provider = FakeChatProvider(reply="ok")
    orchestrator = _orchestrator(provider)

    await orchestrator.generate_reply(
        store_name="Test Store",
        persona=None,
        language=language,
        query="hi",
        products=[],
        history=[],
    )

    assert expected_snippet in provider.last_messages[0].content


# --- Turn planning (conversational salesperson behaviour) ---


def test_parse_plan_reads_a_clean_clarify_object() -> None:
    plan = _parse_plan('{"action": "clarify", "slots": {"category": "shirt"}, '
                        '"search_query": null, "reply": "Casual ya formal?"}')
    assert plan is not None
    assert plan.action == "clarify"
    assert plan.slots == {"category": "shirt"}
    assert plan.reply == "Casual ya formal?"
    assert plan.search_query is None


def test_parse_plan_reads_a_search_object() -> None:
    plan = _parse_plan('{"action": "search", "slots": {"budget": "3000"}, '
                        '"search_query": "casual black shirt 3000", "reply": null}')
    assert plan is not None
    assert plan.action == "search"
    assert plan.search_query == "casual black shirt 3000"
    assert plan.slots == {"budget": "3000"}


def test_parse_plan_tolerates_code_fences_and_prose() -> None:
    raw = 'Sure! Here is the plan:\n```json\n{"action": "search", "search_query": "shoes"}\n```'
    plan = _parse_plan(raw)
    assert plan is not None
    assert plan.action == "search"
    assert plan.search_query == "shoes"


def test_parse_plan_drops_null_like_slot_values() -> None:
    plan = _parse_plan('{"action": "search", "slots": {"color": "black", "size": "null", '
                        '"style": "none", "brand": ""}, "search_query": "black shirt"}')
    assert plan is not None
    # Only the genuinely-stated slot survives; the model's placeholder
    # non-values must never accumulate into context.
    assert plan.slots == {"color": "black"}


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "not json at all",
        '{"action": "buy"}',  # not one of search/clarify
        "[1, 2, 3]",  # valid JSON, wrong shape
    ],
)
def test_parse_plan_returns_none_on_garbage(raw: str) -> None:
    assert _parse_plan(raw) is None


async def test_plan_turn_returns_none_when_no_provider() -> None:
    orchestrator = _orchestrator(None)
    plan = await orchestrator.plan_turn(
        store_name="Test Store",
        language="english",
        known_preferences="none yet",
        clarifications_so_far=0,
        query="hi",
        history=[],
    )
    assert plan is None


async def test_plan_turn_returns_none_when_provider_fails() -> None:
    provider = FakeChatProvider(error=RuntimeError("boom"))
    orchestrator = _orchestrator(provider)
    plan = await orchestrator.plan_turn(
        store_name="Test Store",
        language="english",
        known_preferences="none yet",
        clarifications_so_far=0,
        query="mujhe shirt chahiye",
        history=[],
    )
    assert plan is None


async def test_plan_turn_parses_a_clarify_decision() -> None:
    provider = FakeChatProvider(
        reply='{"action": "clarify", "slots": {"category": "shirt", "color": "black"}, '
        '"search_query": null, "reply": "Casual ya formal?"}'
    )
    orchestrator = _orchestrator(provider)
    plan = await orchestrator.plan_turn(
        store_name="Test Store",
        language="roman_urdu",
        known_preferences="none yet",
        clarifications_so_far=0,
        query="mujhe black shirt chahiye",
        history=[],
    )
    assert plan is not None
    assert plan.action == "clarify"
    assert plan.reply == "Casual ya formal?"
    # The planner prompt carries the running preference/question state.
    assert "Clarifying questions already asked this conversation: 0" in provider.last_messages[0].content


# --- Product context: what the assistant is actually able to say about an item ---


def _detailed_product() -> Product:
    return Product(
        id=uuid4(),
        tenant_id=uuid4(),
        external_id="SKU-D",
        title="Casual Black Cotton Shirt",
        description="  Relaxed-fit  casual  black shirt  in soft breathable cotton.  ",
        price=Decimal("2200"),
        currency="PKR",
        stock_qty=7,
        status=ProductStatus.ACTIVE,
        attributes={"fabric": "cotton", "fit": "relaxed", "empty": ""},
    )


def test_product_context_carries_real_features_and_details() -> None:
    """Without these the assistant can only recite titles and prices — it
    couldn't answer "what's it made of?" from real catalog data."""
    context = format_product_context([_detailed_product()])

    assert "features: Relaxed-fit casual black shirt in soft breathable cotton." in context
    assert "fabric: cotton" in context
    assert "fit: relaxed" in context
    # Blank attribute values are noise in a prompt, not information.
    assert "empty:" not in context


def test_product_context_reports_real_stock_count() -> None:
    assert "in stock, 7 available" in format_product_context([_detailed_product()])


def test_product_context_truncates_a_long_description() -> None:
    product = _detailed_product()
    product.description = "x" * 500
    context = format_product_context([product])

    assert "…" in context
    # Bounded regardless of how much prose a tenant wrote.
    assert len(context) < 500


def test_out_of_stock_product_is_reported_as_such() -> None:
    product = _detailed_product()
    product.stock_qty = 0
    assert "out of stock" in format_product_context([product])


def test_system_prompt_allows_comparison_but_forbids_invented_ratings() -> None:
    prompt = build_system_prompt(store_name="Test Store", persona=None, language="english")

    # Comparing and suggesting extras are explicitly in scope...
    assert "Comparing" in prompt
    assert "complementary" in prompt
    # ...but this catalog has no discount/rating data, so it must never imply any.
    assert "discounts, ratings, or reviews — never mention or imply any" in prompt
