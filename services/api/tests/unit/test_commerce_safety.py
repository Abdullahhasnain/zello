from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.domain.entities.order import Cart, CartItem, CartStatus, PaymentProvider
from app.domain.entities.product import Product, ProductStatus
from app.modules.ai.orchestrator import _parse_plan
from app.modules.conversations.product_matching import matches_preferences
from app.modules.conversations.router import _explicit_cart_request
from app.modules.orders.service import OrderService
from app.shared.exceptions import NotFoundError, ValidationError


def setup_shop():
    tenant, customer = uuid4(), uuid4()
    product = Product(
        id=uuid4(),
        tenant_id=tenant,
        external_id="demo",
        title="DEMO Black Sneakers - Size 42",
        price=Decimal("2490"),
        currency="PKR",
        stock_qty=3,
        status=ProductStatus.ACTIVE,
    )
    cart = Cart(id=uuid4(), tenant_id=tenant, customer_id=customer, status=CartStatus.OPEN)
    item = CartItem(id=uuid4(), cart_id=cart.id, product_id=product.id, quantity=1, unit_price=product.price)
    carts = SimpleNamespace(
        get_by_id=AsyncMock(return_value=cart),
        list_items=AsyncMock(return_value=[item]),
        update_item=AsyncMock(side_effect=lambda x: x),
        update=AsyncMock(side_effect=lambda x: x),
        add=AsyncMock(side_effect=lambda x: x),
    )
    products = SimpleNamespace(
        get_by_id=AsyncMock(return_value=product),
        get_for_update=AsyncMock(return_value=product),
        update=AsyncMock(side_effect=lambda x: x),
    )
    orders = SimpleNamespace(add=AsyncMock(side_effect=lambda x: x))
    service = OrderService(carts, orders, products, customer_id=customer)
    return service, cart, item, product, orders


async def test_checkout_reduces_stock_and_cannot_run_twice():
    service, cart, _, product, orders = setup_shop()
    order = await service.checkout(cart.tenant_id, cart.id, PaymentProvider.COD)
    assert order.total_amount == Decimal("2490")
    assert product.stock_qty == 2
    assert cart.status == CartStatus.CONVERTED
    with pytest.raises(ValidationError):
        await service.checkout(cart.tenant_id, cart.id, PaymentProvider.COD)
    assert orders.add.await_count == 1


async def test_cart_belongs_to_customer_not_just_tenant():
    service, cart, _, product, _ = setup_shop()
    cart.customer_id = uuid4()
    with pytest.raises(NotFoundError):
        await service.add_item(cart.id, product.id, 1)


async def test_legacy_unowned_cart_is_not_adopted():
    service, cart, _, _, _ = setup_shop()
    cart.customer_id = None
    with pytest.raises(NotFoundError):
        await service.get_cart(cart.tenant_id, cart.id)


async def test_cart_creation_sets_customer():
    service, cart, _, _, _ = setup_shop()
    created = await service.create_cart(cart.tenant_id)
    assert created.customer_id == cart.customer_id


async def test_rejects_out_of_stock_and_excess_merged_quantity():
    service, cart, _, product, _ = setup_shop()
    with pytest.raises(ValidationError):
        await service.add_item(cart.id, product.id, 3)
    product.stock_qty = 0
    with pytest.raises(ValidationError):
        await service.add_item(cart.id, product.id, 1)


async def test_checkout_rechecks_stock_and_price():
    service, cart, _, product, orders = setup_shop()
    product.stock_qty = 0
    with pytest.raises(ValidationError):
        await service.checkout(cart.tenant_id, cart.id, PaymentProvider.COD)
    product.stock_qty = 3
    product.price = Decimal("3000")
    with pytest.raises(ValidationError):
        await service.checkout(cart.tenant_id, cart.id, PaymentProvider.COD)
    orders.add.assert_not_awaited()


async def test_other_tenant_and_disabled_payments_rejected():
    service, cart, _, _, _ = setup_shop()
    with pytest.raises(NotFoundError):
        await service.checkout(uuid4(), cart.id, PaymentProvider.COD)
    with pytest.raises(ValidationError):
        await service.checkout(cart.tenant_id, cart.id, PaymentProvider.JAZZCASH)


@pytest.mark.parametrize(
    "text", ["add this to cart", "sasta wala cart mein daal do", "یہ کارٹ میں شامل کریں"]
)
def test_explicit_cart_authorization(text):
    assert _explicit_cart_request(text)


@pytest.mark.parametrize(
    "text",
    [
        "don't add to cart",
        "cart mein mat dalo",
        "how to add to cart",
        "kitne ka hai",
        "یہ کارٹ میں شامل نہیں کریں",
    ],
)
def test_questions_and_negations_never_authorize_cart(text):
    assert not _explicit_cart_request(text)


def test_exact_product_attributes_and_unknowns():
    _, _, _, product, _ = setup_shop()
    assert matches_preferences(product, {"size": "42", "color": "black"})
    assert matches_preferences(product, {"size": "42", "color": "کالا"})
    assert not matches_preferences(product, {"size": "41"})
    assert not matches_preferences(product, {"color": "white"})
    product.title = "Plain sneakers"
    assert not matches_preferences(product, {"size": "42"})
    product.attributes = {"Size": "42", "Colour": "black"}
    assert matches_preferences(product, {"size": "42", "color": "black"})


@pytest.mark.parametrize("quantity", ["-1", "0", "21", "true", '"2"'])
def test_invalid_cart_plan_quantity_is_rejected(quantity):
    assert _parse_plan('{"action":"add_to_cart","quantity":' + quantity + "}") is None
