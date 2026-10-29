"""HTTP smoke coverage for the grounded Rufus-style commerce journey.

This intentionally drives the real FastAPI routes with ``httpx.AsyncClient``
while replacing infrastructure dependencies at the app boundary. It neither
connects to Postgres/Redis nor calls a real LLM or Edge TTS service.
"""

import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi import FastAPI

from app.core.config import get_settings
from app.core.security import AuthContext
from app.domain.entities.conversation import (
    Conversation,
    ConversationChannel,
    ConversationMessage,
    ConversationStatus,
    MessageRole,
)
from app.domain.entities.product import Product, ProductStatus
from app.modules.ai.dependencies import get_ai_orchestrator
from app.modules.ai.orchestrator import AIOrchestrator
from app.modules.analytics.dependencies import get_analytics_service_for_customer
from app.modules.catalog.dependencies import get_catalog_service_for_customer
from app.modules.conversations.dependencies import get_conversation_service_for_customer
from app.modules.orders.dependencies import get_order_service_for_customer
from app.modules.search.dependencies import get_search_service_for_customer
from app.modules.tenants.dependencies import get_tenant_service_for_customer
from app.modules.voice.dependencies import get_voice_service
from app.modules.voice.service import VoiceService
from app.shared.deps import get_current_customer_auth


class InMemoryConversationService:
    def __init__(self, conversation: Conversation) -> None:
        self.conversation = conversation
        self.messages: list[ConversationMessage] = []

    async def get_conversation(self, _conversation_id: UUID) -> Conversation:
        return self.conversation

    async def get_transcript(self, _conversation_id: UUID) -> list[ConversationMessage]:
        return list(self.messages)

    async def record_message(
        self,
        conversation_id: UUID,
        role: MessageRole,
        content: str,
        **kwargs: object,
    ) -> ConversationMessage:
        message = ConversationMessage(
            id=uuid4(),
            conversation_id=conversation_id,
            role=role,
            content=content,
            created_at=datetime.now(UTC),
            **kwargs,
        )
        self.messages.append(message)
        return message

    async def touch_activity(self, _conversation_id: UUID) -> None:
        self.conversation.last_activity_at = datetime.now(UTC)

    async def update_context(self, _conversation_id: UUID, values: dict) -> None:
        self.conversation.context.update(values)


class InMemoryCatalogService:
    def __init__(self, products: list[Product]) -> None:
        self.products = {product.id: product for product in products}

    async def get_product(self, _tenant_id: UUID, product_id: UUID) -> Product:
        return self.products[product_id]


class InMemorySearchService:
    def __init__(self, products: list[Product]) -> None:
        self.products = products

    async def search_products(self, _tenant_id: UUID, _query: str, *, top_k: int) -> list[Product]:
        return self.products[:top_k]


class InMemoryOrderService:
    def __init__(self, tenant_id: UUID) -> None:
        self.cart = SimpleNamespace(id=uuid4(), tenant_id=tenant_id, status=SimpleNamespace(value="open"))
        self.items: list[SimpleNamespace] = []

    async def get_cart(self, _tenant_id: UUID, cart_id: UUID) -> SimpleNamespace:
        if cart_id != self.cart.id:
            raise AssertionError("unexpected cart")
        return self.cart

    async def create_cart(self, _tenant_id: UUID, _conversation_id: UUID) -> SimpleNamespace:
        return self.cart

    async def add_item(self, _cart_id: UUID, product_id: UUID, quantity: int) -> None:
        self.items.append(SimpleNamespace(product_id=product_id, quantity=quantity))

    async def list_cart_items(self, _cart_id: UUID) -> list[SimpleNamespace]:
        return list(self.items)


class FakeTTSProvider:
    async def transcribe(self, *_args: object, **_kwargs: object) -> str:
        return ""

    async def synthesize(self, *_args: object, **_kwargs: object) -> bytes:
        return b"ID3-fake-mp3"

    async def stream_synthesize(self, *_args: object, **_kwargs: object) -> AsyncIterator[bytes]:
        yield b"ID3-fake-mp3"


class InMemoryAnalyticsService:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict]] = []

    async def record_event(self, _tenant_id: UUID, event_type: str, payload: dict) -> None:
        self.events.append((event_type, payload))


@pytest.fixture
def smoke_app(monkeypatch: pytest.MonkeyPatch) -> tuple[FastAPI, Conversation, Product, Product]:
    """Create the production router graph with all external services overridden."""
    required_env = {
        "DATABASE_URL": "postgresql://test:test@localhost:5432/zello",
        "DATABASE_URL_APP": "postgresql://test:test@localhost:5432/zello_app",
        "REDIS_URL": "redis://localhost:6379/0",
        "INTERNAL_SERVICE_TOKEN": "test-internal-token",
        "CUSTOMER_JWT_SECRET": "test-customer-secret",
        "PARTNER_API_HMAC_SECRET": "test-partner-secret",
        "OPENAI_API_KEY": "test-openai-key",
    }
    for name, value in required_env.items():
        monkeypatch.setenv(name, value)
    get_settings.cache_clear()

    # Imported after test settings are in place: app.main also creates its
    # module-level application, but the test uses a fresh app below.
    from app import main as main_module
    from app.modules.conversations import router as conversation_router

    tenant_id, customer_id, conversation_id = uuid4(), uuid4(), uuid4()
    now = datetime.now(UTC)
    conversation = Conversation(
        id=conversation_id,
        tenant_id=tenant_id,
        customer_id=customer_id,
        channel=ConversationChannel.WIDGET,
        status=ConversationStatus.ACTIVE,
        language="english",
        started_at=now,
        last_activity_at=now,
    )
    product_a = Product(
        id=uuid4(),
        tenant_id=tenant_id,
        external_id="product-a",
        title="Product A",
        price=Decimal("12.00000"),
        currency="PKR",
        stock_qty=4,
        status=ProductStatus.ACTIVE,
        description="Lightweight daily option",
    )
    product_b = Product(
        id=uuid4(),
        tenant_id=tenant_id,
        external_id="product-b",
        title="Product B",
        price=Decimal("18.50000"),
        currency="PKR",
        stock_qty=2,
        status=ProductStatus.ACTIVE,
        description="Performance-focused option",
    )
    conversations = InMemoryConversationService(conversation)
    catalog = InMemoryCatalogService([product_a, product_b])
    search = InMemorySearchService([product_a, product_b])
    orders = InMemoryOrderService(tenant_id)
    auth = AuthContext(
        actor_type="customer",
        subject_id=str(customer_id),
        tenant_id=tenant_id,
        role=None,
        raw_claims={},
    )
    async def get_tenant(_tenant_id: UUID) -> SimpleNamespace:
        return SimpleNamespace(name="Smoke Store", branding={})

    tenant = SimpleNamespace(get_tenant=get_tenant)
    orchestrator = AIOrchestrator(None, max_tokens=100, temperature=0, history_turns=5)
    voice = VoiceService(FakeTTSProvider(), max_audio_bytes=1024)
    analytics = InMemoryAnalyticsService()

    async def allow_rate_limit(*_args: object, **_kwargs: object) -> None:
        return None

    async def allow_conversation_rate_limit(*_args: object, **_kwargs: object) -> bool:
        return True

    monkeypatch.setattr(main_module, "enforce_rate_limit", allow_rate_limit)
    monkeypatch.setattr(main_module, "get_redis_client", lambda: None)
    monkeypatch.setattr(conversation_router, "enforce_conversation_rate_limit", allow_conversation_rate_limit)
    monkeypatch.setattr(conversation_router, "get_redis_client", lambda: None)

    app = main_module.create_app()
    app.dependency_overrides = {
        get_current_customer_auth: lambda: auth,
        get_conversation_service_for_customer: lambda: conversations,
        get_catalog_service_for_customer: lambda: catalog,
        get_search_service_for_customer: lambda: search,
        get_tenant_service_for_customer: lambda: tenant,
        get_ai_orchestrator: lambda: orchestrator,
        get_order_service_for_customer: lambda: orders,
        get_analytics_service_for_customer: lambda: analytics,
        get_voice_service: lambda: voice,
    }
    yield app, conversation, product_a, product_b
    app.dependency_overrides.clear()
    get_settings.cache_clear()


async def test_rufus_voice_commerce_smoke(
    smoke_app: tuple[FastAPI, Conversation, Product, Product],
) -> None:
    app, conversation, product_a, product_b = smoke_app
    transport = httpx.ASGITransport(app=app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        decimal_response = await client.post(
            f"/api/v1/conversations/{conversation.id}/messages",
            json={"content": "show me the products"},
        )
        assert decimal_response.status_code == 201
        decimal_text = decimal_response.json()["assistantMessage"]["content"]
        assert "PKR 12" in decimal_text
        assert ".00000" not in decimal_text

        comparison_response = await client.post(
            f"/api/v1/conversations/{conversation.id}/messages/stream",
            json={"content": "compare Product A and Product B"},
        )
        assert comparison_response.status_code == 200
        assert comparison_response.headers["content-type"].startswith("application/x-ndjson")
        events = [json.loads(line) for line in comparison_response.text.splitlines()]
        assert events[0] == {"type": "started"}
        comparison = events[-1]["data"]["assistantMessage"]
        assert comparison["intent"]["matched_product_ids"] == [str(product_a.id), str(product_b.id)]
        assert "comparison" in comparison["content"].lower()

        # A product-detail page supplies its current real catalogue ID so
        # deictic questions such as "is product" remain grounded.
        conversation.context.clear()
        detail_response = await client.post(
            f"/api/v1/conversations/{conversation.id}/messages",
            json={"content": "is product ka price kya hai?", "currentProductId": str(product_b.id)},
        )
        assert detail_response.status_code == 201
        assert detail_response.json()["assistantMessage"]["intent"]["matched_product_ids"] == [
            str(product_b.id)
        ]

        # Positional follow-ups must select exactly the card the shopper
        # referenced instead of repeating the entire previous result list.
        conversation.context["last_matched_product_ids"] = [str(product_a.id), str(product_b.id)]
        second_response = await client.post(
            f"/api/v1/conversations/{conversation.id}/messages",
            json={"content": "second wala kaisa hai?"},
        )
        assert second_response.status_code == 201
        assert second_response.json()["assistantMessage"]["intent"]["matched_product_ids"] == [
            str(product_b.id)
        ]

        # A single grounded recent product makes "yeh" unambiguous.
        conversation.context["last_matched_product_ids"] = [str(product_a.id)]
        cart_response = await client.post(
            f"/api/v1/conversations/{conversation.id}/messages",
            json={"content": "yeh cart me daal do"},
        )
        assert cart_response.status_code == 201
        cart_body = cart_response.json()
        assert cart_body["action"] == {
            "type": "ADD_TO_CART",
            "payload": {"productId": str(product_a.id), "quantity": 1, "title": "Product A"},
        }
        assert "Product A" in cart_body["assistantMessage"]["content"]
        assert "cart" in cart_body["assistantMessage"]["content"].lower()

        tts_response = await client.post(
            "/api/v1/voice/tts",
            json={"text": "Product A cart mein add ho gaya.", "language": "roman_urdu"},
        )
        assert tts_response.status_code == 200
        assert tts_response.headers["content-type"].startswith("audio/mpeg")
        assert tts_response.content.startswith(b"ID3")
