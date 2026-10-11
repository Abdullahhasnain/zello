import asyncio
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
from app.modules.conversations.language import response_language
from app.modules.conversations.product_matching import (
    extract_comparison_terms,
    is_comparison_intent,
    match_comparison_products,
    matches_preferences,
)
from app.modules.conversations.reply_composer import (
    compose_cart_confirmation,
    compose_greeting,
    extract_cart_quantity,
    is_cart_request,
)
from app.modules.conversations.schemas import (
    ConversationActionRead,
    ConversationMessageRead,
    ConversationRead,
    ConversationStartResponse,
    MessageExchangeRead,
    PostMessageRequest,
)
from app.modules.conversations.service import ConversationService
from app.modules.orders.dependencies import get_order_service_for_customer
from app.modules.orders.service import OrderService
from app.modules.search.dependencies import get_search_service_for_customer
from app.modules.search.normalization import detect_language
from app.modules.search.service import SearchService
from app.modules.tenants.dependencies import get_tenant_service_for_customer
from app.modules.tenants.schemas import TenantBranding
from app.modules.tenants.service import TenantService
from app.shared.deps import get_current_customer_auth, get_current_store_auth
from app.shared.exceptions import NotFoundError, RateLimitExceededError, ValidationError
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
_SEARCH_TIMEOUT_SECONDS = 5.0

_FOLLOW_UP_REFERENCE = re.compile(
    r"\b(this|that|these|those|it|one|ones|ye|yeh|woh|wo|wala|wali|walay|"
    r"available|cheaper|sasta|sasti|options|compare|recommend|یہ|وہ|والا|سستا)\b",
    re.IGNORECASE,
)

# A customer speaks in positions because product cards are displayed in a
# stable order. Keep that interpretation deterministic rather than asking an
# LLM to remember which card was "second".
_PRODUCT_POSITION = re.compile(
    r"\b(?:(?P<first>first|1st|pehla|pehli|pehle|pehlay)|(?P<second>second|2nd|doosra|dusra|dusri)|"
    r"(?P<recommended>recommend(?:ed)?|suggest(?:ed)?|best))\b|"
    r"(?:(?P<urdu_first>پہلا|پہلی)|(?P<urdu_second>دوسرا|دوسری)|(?P<urdu_recommended>ریکمینڈ))",
    re.IGNORECASE,
)

_CHEAPER_REQUEST = re.compile(
    r"\b(?:cheaper|cheap|less|sasta|sasti|kam|budget)\b|سستا|کم",
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


def _is_cheaper_request(text: str) -> bool:
    return bool(_CHEAPER_REQUEST.search(text))


def _explicit_cart_request(text: str) -> bool:
    """Backward-compatible name for the deterministic cart safety gate."""
    return is_cart_request(text)


def _select_cart_product(
    products: list[Product],
    text: str,
    planned_product_id: str | None,
) -> Product | None:
    """Resolve a requested product from grounded, recently shown products.

    A planner UUID wins only when it belongs to that real context. Without a
    planner, accept a title explicitly spoken by the shopper, or the single
    product that was last shown. Multiple unnamed choices stay ambiguous and
    require a follow-up rather than silently adding the first card.
    """
    if planned_product_id:
        selected = next((product for product in products if str(product.id) == planned_product_id), None)
        if selected:
            return selected

    position = _PRODUCT_POSITION.search(text)
    if position:
        groups = position.groupdict()
        if (groups.get("first") or groups.get("urdu_first") or groups.get("recommended")) and products:
            return products[0]
        if (groups.get("second") or groups.get("urdu_second")) and len(products) > 1:
            return products[1]

    normalized_text = " ".join(re.findall(r"[\w]+", text.casefold()))
    named = [
        product
        for product in products
        if " ".join(re.findall(r"[\w]+", product.title.casefold())) in normalized_text
    ]
    if len(named) == 1:
        return named[0]
    return products[0] if len(products) == 1 else None


async def _keyword_catalog_search(
    catalog_service: CatalogService,
    tenant_id: UUID,
    query: str,
    *,
    top_k: int,
) -> list[Product]:
    """Safe local fallback for an offline embedding service.

    It is intentionally tenant-scoped and only reads catalog records through
    the existing service. This keeps a local Ollama sales brain useful even
    when OpenAI/Gemini embeddings are not configured, without pretending a
    keyword match is semantic retrieval or changing any database schema.
    """
    tokens = {token.casefold() for token in re.findall(r"[\w]+", query) if len(token) > 1}
    if not tokens:
        return []
    products = await catalog_service.list_products(tenant_id, limit=100)
    scored: list[tuple[int, Product]] = []
    for product in products:
        searchable = " ".join(
            [product.title, product.description or "", *map(str, product.attributes.values())]
        ).casefold()
        score = sum(1 for token in tokens if token in searchable)
        if score:
            scored.append((score, product))
    scored.sort(key=lambda item: (-item[0], item[1].title.casefold()))
    return [product for _, product in scored[:top_k]]


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
            results = await search_service.search_products(tenant_id, str(term), top_k=_REPLY_PRODUCT_LIMIT)
        except Exception:  # noqa: BLE001 — an embeddings outage just means no alternatives
            results = []
        if results:
            return results
    return []


async def _find_comparison_products(
    search_service: SearchService,
    tenant_id: UUID,
    query: str,
    recent_products: list[Product],
    found_products: list[Product],
) -> list[Product]:
    """Resolve the two products named by a comparison without new storage."""
    candidates = [*recent_products, *found_products]
    terms = extract_comparison_terms(query)
    if terms:
        for term in terms:
            try:
                candidates.extend(await search_service.search_products(tenant_id, term, top_k=3))
            except Exception:  # noqa: BLE001 - a partial comparison still has the current context
                continue

    deduplicated: list[Product] = []
    seen_ids: set[UUID] = set()
    for product in candidates:
        if product.id not in seen_ids:
            deduplicated.append(product)
            seen_ids.add(product.id)
    return match_comparison_products(query, deduplicated)


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
    order_service: Annotated[OrderService, Depends(get_order_service_for_customer)],
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
    if conversation.customer_id != UUID(_auth.subject_id):
        raise NotFoundError("Conversation not found")

    history = await conversation_service.get_transcript(conversation_id)
    if payload.request_id:
        previous = [m for m in history if m.intent.get("request_id") == str(payload.request_id)]
        customer = next((m for m in previous if m.role == MessageRole.CUSTOMER), None)
        assistant = next((m for m in previous if m.role == MessageRole.ASSISTANT), None)
        if customer and assistant:
            stored_action = assistant.intent.get("action_metadata")
            return MessageExchangeRead(
                customer_message=ConversationMessageRead.model_validate(customer),
                assistant_message=ConversationMessageRead.model_validate(assistant),
                action=stored_action if isinstance(stored_action, dict) else None,
            )

    if not await enforce_conversation_rate_limit(str(conversation_id), get_redis_client()):
        raise RateLimitExceededError()

    customer_message = await conversation_service.record_message(
        conversation_id,
        MessageRole.CUSTOMER,
        payload.content,
        intent={"request_id": str(payload.request_id)} if payload.request_id else {},
    )
    await conversation_service.touch_activity(conversation_id)

    tenant = await tenant_service.get_tenant(conversation.tenant_id)
    context = conversation.context or {}

    detected = detect_language(payload.content)
    prior_language = context.get("response_language")
    if not prior_language:
        # Recover old sessions from their first customer turn, not an STT-induced switch.
        first_customer = next((m for m in history if m.role == MessageRole.CUSTOMER), None)
        prior_language = (
            detect_language(first_customer.content) if first_customer else (conversation.language or detected)
        )
    turn_language = response_language(payload.content, str(prior_language))

    clarifications_so_far = int(context.get("clarification_count", 0) or 0)
    comparison_requested = is_comparison_intent(payload.content)
    cart_requested = is_cart_request(payload.content)
    references_recent_products = _references_recent_products(payload.content) and bool(
        context.get("last_matched_product_ids")
    )
    references_recent_products = references_recent_products or (
        comparison_requested and bool(context.get("last_matched_product_ids"))
    )

    recent_products = await _load_recent_products(
        catalog_service, conversation.tenant_id, context.get("last_matched_product_ids")
    )
    plan = await ai_orchestrator.plan_turn(
        store_name=tenant.name,
        language=turn_language,
        known_preferences=format_known_preferences(context),
        clarifications_so_far=clarifications_so_far,
        query=payload.content,
        history=history,
        recent_products=recent_products,
    )

    # Accumulate any newly-stated preferences so both this turn's grounded
    # reply and every later turn's planning see the full picture.
    if plan and plan.slots.get("category") and plan.slots["category"] != context.get("category"):
        # A new product type should not inherit an unrelated size/style.
        context = {k: v for k, v in context.items() if k not in ("size", "style", "occasion")}
    merged_context: dict = {
        **context,
        **(plan.slots if plan else {}),
        "language": turn_language,
        "response_language": turn_language,
    }

    is_clarify = (
        plan is not None
        and plan.action == "clarify"
        and clarifications_so_far < _MAX_CLARIFICATIONS
        and not references_recent_products
        and not comparison_requested
        and not cart_requested
    )

    cart_intent = {}
    cart_action: ConversationActionRead | dict | None = None
    is_cart = cart_requested
    if is_cart:
        selected = _select_cart_product(
            recent_products,
            payload.content,
            plan.product_id if plan and plan.action == "add_to_cart" else None,
        )
        quantity = (
            plan.quantity
            if plan and plan.action == "add_to_cart"
            else extract_cart_quantity(payload.content)
        )
        matched_product_ids = [str(selected.id)] if selected else []
        ai_generated = False  # factual transaction receipt, never fabricated by the LLM
        if (
            not selected
            or not matches_preferences(selected, merged_context)
        ):
            reply_text = "Please name the product you want me to add to your cart."
            if turn_language == "roman_urdu":
                reply_text = "Kaunsa product cart mein daalna hai? Uska naam bata dein."
            elif turn_language == "urdu":
                reply_text = "کون سا پروڈکٹ کارٹ میں ڈالنا ہے؟ اس کا نام بتا دیں۔"
        else:
            try:
                cart = None
                cart_id = payload.cart_id or context.get("cart_id")
                if cart_id:
                    try:
                        cart = await order_service.get_cart(conversation.tenant_id, UUID(str(cart_id)))
                        if cart.status.value != "open":
                            cart = None
                    except NotFoundError:
                        cart = None
                if cart is None:
                    cart = await order_service.create_cart(conversation.tenant_id, conversation_id)
                await order_service.add_item(cart.id, selected.id, quantity)
                items = await order_service.list_cart_items(cart.id)
                cart_action = {
                    "type": "ADD_TO_CART",
                    "payload": {
                        "product_id": str(selected.id),
                        "quantity": quantity,
                        "title": selected.title,
                    },
                }
                cart_intent = {
                    "cart_id": str(cart.id),
                    "cart_count": sum(i.quantity for i in items),
                    # Persist an additive copy for replay/idempotency while
                    # leaving the legacy string `intent.action` unchanged.
                    "action_metadata": cart_action,
                }
                merged_context["cart_id"] = str(cart.id)
                reply_text = compose_cart_confirmation(turn_language, selected, quantity)
            except ValidationError:
                reply_text = "I couldn't add that quantity. Please check the available stock and your cart."
                if turn_language == "roman_urdu":
                    reply_text = (
                        "Itni quantity add nahi ho saki. Available stock aur apna cart check kar lein."
                    )
    elif is_clarify:
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
            # A changed colour/size must trigger a fresh search, not remain
            # trapped in the old recommendation set.
            if not any(matches_preferences(p, merged_context) for p in found):
                found = []
        if not found:
            try:
                found = await asyncio.wait_for(
                    search_service.search_products(conversation.tenant_id, search_query, top_k=20),
                    timeout=_SEARCH_TIMEOUT_SECONDS,
                )
            except Exception as exc:  # noqa: BLE001 — an embeddings-provider outage (bad/missing
                # key, rate limit, network) must degrade to a real local
                # catalog lookup, never a 500 or invented products.
                logger.warning("product_search_failed", conversation_id=str(conversation_id), error=str(exc))
                found = await _keyword_catalog_search(
                    catalog_service, conversation.tenant_id, search_query, top_k=20
                )

        comparison_products = []
        if comparison_requested:
            comparison_products = await _find_comparison_products(
                search_service,
                conversation.tenant_id,
                payload.content,
                recent_products,
                found,
            )

        # Respect a stated budget the way a salesperson would, but honestly.
        # `found` is ranked by relevance, so found[0] is the best match for
        # what they actually asked for. If that best match is within budget,
        # show the in-budget results as a real match. If the best match is
        # OVER budget, the customer's actual request isn't affordable here —
        # don't quietly scrape together cheaper-but-irrelevant items and
        # present them as if they were what was asked; instead offer the
        # real (over-budget) options as honest alternatives ("nothing under
        # X, but we do have these from Y").
        found = [p for p in found if matches_preferences(p, merged_context)]
        if references_recent_products and _is_cheaper_request(payload.content):
            recommended_id = context.get("last_recommended_product_id")
            recommended = next((p for p in recent_products if str(p.id) == str(recommended_id)), None)
            if recommended is not None:
                cheaper = [p for p in found if p.price < recommended.price]
                if cheaper:
                    found = sorted(cheaper, key=lambda product: product.price)
        budget = _extract_budget(merged_context.get("budget"))
        if len(comparison_products) == 2:
            matched_products = comparison_products
            exact_match = True
        elif budget is None:
            matched_products = found[:_REPLY_PRODUCT_LIMIT]
            exact_match = bool(found)
        elif found and float(found[0].price) <= budget:
            matched_products = [p for p in found if float(p.price) <= budget][:_REPLY_PRODUCT_LIMIT]
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
            matched_products = [p for p in matched_products if matches_preferences(p, merged_context)]
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
            comparison=comparison_requested and len(matched_products) == 2,
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
            "action": "add_to_cart" if cart_intent else ("clarify" if is_clarify or is_cart else "search"),
            "request_id": str(payload.request_id) if payload.request_id else None,
            **cart_intent,
        },
    )

    merged_context["last_query"] = payload.content
    if matched_product_ids:
        merged_context["last_matched_product_ids"] = matched_product_ids
        # Search preserves ranked order, so the first real result is the
        # deterministic default recommendation for phrases such as "jo tum
        # recommend kar rahe ho". We keep the full ordered list as well for
        # first/second references and comparisons.
        merged_context["last_recommended_product_id"] = matched_product_ids[0]
    await conversation_service.update_context(conversation_id, merged_context)

    return MessageExchangeRead(
        customer_message=ConversationMessageRead.model_validate(customer_message),
        assistant_message=ConversationMessageRead.model_validate(assistant_message),
        action=cart_action,
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
