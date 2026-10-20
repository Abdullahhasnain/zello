from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.domain.entities.conversation import ConversationMessage, MessageRole
from app.domain.entities.product import Product, ProductStatus
from app.modules.ai.orchestrator import TurnPlan
from app.modules.conversations import router
from app.modules.conversations.schemas import PostMessageRequest
from app.shared.exceptions import NotFoundError
from tests.unit.test_commerce_safety import setup_shop


def test_cart_reference_resolves_the_second_shown_product():
    """Card order is persisted in context, so ordinal speech never relies
    on the LLM inventing a product identity."""
    _, _, _, first, _ = setup_shop()
    second = Product(
        id=uuid4(),
        tenant_id=first.tenant_id,
        external_id="second-shoe",
        title="DEMO Running Shoes",
        price=Decimal("3990"),
        currency="PKR",
        stock_qty=2,
        status=ProductStatus.ACTIVE,
    )

    assert router._select_cart_product([first, second], "second wala cart mein daal do", None) == second
    assert router._select_cart_product([first, second], "pehla add kardo", None) == first
    assert router._select_cart_product([first, second], "jo recommend kiya woh add kar do", None) == first


async def test_voice_cart_action_and_retry_are_one_mutation(monkeypatch):
    orders, cart, _, product, _ = setup_shop()
    conversation = SimpleNamespace(
        id=uuid4(),
        tenant_id=cart.tenant_id,
        customer_id=cart.customer_id,
        language="roman_urdu",
        context={"last_matched_product_ids": [str(product.id)]},
    )
    history = []

    async def record(cid, role, content, **kwargs):
        msg = ConversationMessage(
            id=uuid4(),
            conversation_id=cid,
            role=role,
            content=content,
            created_at=datetime.now(UTC),
            **kwargs,
        )
        history.append(msg)
        return msg

    async def update_context(cid, values):
        conversation.context.update(values)

    conversations = SimpleNamespace(
        get_conversation=AsyncMock(return_value=conversation),
        get_transcript=AsyncMock(side_effect=lambda cid: list(history)),
        record_message=record,
        touch_activity=AsyncMock(),
        update_context=update_context,
    )
    ai = SimpleNamespace(
        plan_turn=AsyncMock(
            return_value=TurnPlan(action="add_to_cart", product_id=str(product.id), quantity=1)
        )
    )
    auth = SimpleNamespace(subject_id=str(cart.customer_id), tenant_id=cart.tenant_id)
    catalog = SimpleNamespace(get_product=AsyncMock(return_value=product))
    tenants = SimpleNamespace(get_tenant=AsyncMock(return_value=SimpleNamespace(name="Demo", branding={})))
    monkeypatch.setattr(router, "get_redis_client", lambda: None)
    monkeypatch.setattr(router, "enforce_conversation_rate_limit", AsyncMock(return_value=True))
    payload = PostMessageRequest(content="ye cart mein daal do", cart_id=cart.id, request_id=uuid4())
    args = (conversation.id, payload, auth, conversations, None, catalog, tenants, ai, orders, None)
    result = await router.post_message(*args)
    assert result.assistant_message.intent["action"] == "add_to_cart"
    assert result.assistant_message.intent["cart_count"] == 2
    replay = await router.post_message(*args)
    assert replay.assistant_message.id == result.assistant_message.id
    orders._carts.update_item.assert_awaited_once()
    assert len(history) == 2
    assert history[0].role == MessageRole.CUSTOMER


async def test_other_customer_cannot_append_to_conversation():
    conversation = SimpleNamespace(customer_id=uuid4())
    service = SimpleNamespace(get_conversation=AsyncMock(return_value=conversation))
    with pytest.raises(NotFoundError):
        await router.post_message(
            uuid4(),
            PostMessageRequest(content="hello"),
            SimpleNamespace(subject_id=str(uuid4())),
            service,
            None,
            None,
            None,
            None,
            None,
            None,
        )


async def test_out_of_stock_cart_request_names_product_and_returns_only_in_stock_alternatives(
    monkeypatch,
):
    tenant_id = uuid4()
    customer_id = uuid4()
    selected = Product(
        id=uuid4(), tenant_id=tenant_id, external_id="sold-out",
        title="Black Running Pro", description="running shoes", price=Decimal("5990"),
        currency="PKR", stock_qty=0, status=ProductStatus.OUT_OF_STOCK,
        attributes={"category": "running shoes", "color": "black"},
    )
    alternatives = [
        Product(
            id=uuid4(), tenant_id=tenant_id, external_id=f"alt-{index}",
            title=title, description="running shoes", price=Decimal(price),
            currency="PKR", stock_qty=4, status=ProductStatus.ACTIVE,
            attributes={"category": "running shoes", "color": color},
        )
        for index, (title, price, color) in enumerate([
            ("Black Daily Runner", "3990", "black"),
            ("Navy Running Lite", "4490", "navy"),
            ("White Sprint Shoe", "4790", "white"),
        ])
    ]
    unrelated = Product(
        id=uuid4(), tenant_id=tenant_id, external_id="hoodie", title="Brown Hoodie",
        description="warm apparel", price=Decimal("2990"), currency="PKR", stock_qty=5,
        status=ProductStatus.ACTIVE, attributes={"category": "hoodies", "color": "brown"},
    )
    conversation = SimpleNamespace(
        id=uuid4(), tenant_id=tenant_id, customer_id=customer_id,
        language="roman_urdu", context={"last_matched_product_ids": [str(selected.id)]},
    )
    history = []

    async def record(cid, role, content, **kwargs):
        message = ConversationMessage(
            id=uuid4(), conversation_id=cid, role=role, content=content,
            created_at=datetime.now(UTC), **kwargs,
        )
        history.append(message)
        return message

    conversations = SimpleNamespace(
        get_conversation=AsyncMock(return_value=conversation),
        get_transcript=AsyncMock(side_effect=lambda _cid: list(history)),
        record_message=record, touch_activity=AsyncMock(), update_context=AsyncMock(),
    )
    catalog = SimpleNamespace(
        get_product=AsyncMock(return_value=selected),
        list_products=AsyncMock(return_value=[selected, unrelated, *alternatives]),
    )
    monkeypatch.setattr(router, "get_redis_client", lambda: None)
    monkeypatch.setattr(router, "enforce_conversation_rate_limit", AsyncMock(return_value=True))

    result = await router.post_message(
        conversation.id,
        PostMessageRequest(content="yeh cart mein daal do"),
        SimpleNamespace(subject_id=str(customer_id), tenant_id=tenant_id),
        conversations,
        None,
        catalog,
        SimpleNamespace(get_tenant=AsyncMock(return_value=SimpleNamespace(name="Demo", branding={}))),
        SimpleNamespace(plan_turn=AsyncMock()),
        SimpleNamespace(),
        None,
    )

    assert result.action is None
    assert "Black Running Pro" in result.assistant_message.content
    expected = "Yeh product filhaal out of stock hai, is liye cart mein add nahi ho sakta."
    assert expected in result.assistant_message.content
    assert result.assistant_message.intent["matched_product_ids"] == [
        str(product.id) for product in alternatives
    ]
    assert str(unrelated.id) not in result.assistant_message.intent["matched_product_ids"]
