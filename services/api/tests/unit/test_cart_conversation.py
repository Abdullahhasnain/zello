from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.domain.entities.conversation import ConversationMessage, MessageRole
from app.modules.ai.orchestrator import TurnPlan
from app.modules.conversations import router
from app.modules.conversations.schemas import PostMessageRequest
from app.shared.exceptions import NotFoundError
from tests.unit.test_commerce_safety import setup_shop


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
    args = (conversation.id, payload, auth, conversations, None, catalog, tenants, ai, orders)
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
        )
