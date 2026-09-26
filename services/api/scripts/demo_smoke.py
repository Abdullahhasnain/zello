"""Opt-in live smoke test. Creates only a labelled DEMO product COD test order.

No credentials are required or printed: the public guest-session API issues
an isolated test identity in memory. Never run against real inventory.
"""

import argparse
from uuid import uuid4

import httpx


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--slug", default="zello")
    parser.add_argument("--allow-demo-order", action="store_true")
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    with httpx.Client(base_url=base, timeout=90) as client:

        def call(method, path, **kwargs):
            response = client.request(method, path, **kwargs)
            if response.is_error:
                raise RuntimeError(f"{method} {path}: HTTP {response.status_code}")
            return response.json()

        session = call("POST", "/auth/guest-session", json={"tenantSlug": args.slug})
        client.headers["Authorization"] = f"Bearer {session['accessToken']}"
        products = call("GET", "/catalog/storefront/products?limit=100")
        demos = [p for p in products if p["externalId"].startswith("DEMO-")]
        assert len(demos) >= 7, "Demo catalog missing"
        by_id = {p["id"]: p for p in demos}
        started = call("POST", "/conversations?language=roman_urdu")
        cid = started["conversation"]["id"]
        cart_id = None
        fallback_turns = []

        def turn(text):
            payload = {"content": text, "requestId": str(uuid4()), "cartId": cart_id}
            result = call("POST", f"/conversations/{cid}/messages", json=payload)
            assistant = result["assistantMessage"]
            if (
                not assistant["intent"].get("ai_generated")
                and assistant["intent"].get("action") != "add_to_cart"
            ):
                fallback_turns.append(text)
            print(assistant["intent"].get("action"), assistant["content"][:450], flush=True)
            return result, payload

        turn("Assalam o alaikum, mujhe sneakers chahiye")
        result, _ = turn("Black daily wear sneakers, size 42 aur budget 5000. Options dikhao.")
        matched = result["assistantMessage"]["intent"]["matched_product_ids"]
        assert matched, "No matching products"
        for pid in matched:
            assert pid in by_id and "Black" in by_id[pid]["title"] and "Size 42" in by_id[pid]["title"]
            assert float(by_id[pid]["price"]) <= 5000
        turn("Mera budget aur size yaad hai?")
        turn("In mein sab se sasta wala kitne ka hai?")
        result, payload = turn("DEMO Black Budget Sneakers - Size 42 ka ek pair cart mein daal do")
        intent = result["assistantMessage"]["intent"]
        assert intent["action"] == "add_to_cart", "Voice/text cart action did not run"
        cart_id = intent["cart_id"]
        replay = call("POST", f"/conversations/{cid}/messages", json=payload)
        assert replay["assistantMessage"]["id"] == result["assistantMessage"]["id"]
        cart = call("GET", f"/orders/carts/{cart_id}")
        assert len(cart["items"]) == 1 and cart["items"][0]["quantity"] == 1
        target = by_id[cart["items"][0]["productId"]]
        assert target["externalId"] == "DEMO-SHOE-BUD-42"
        assert float(cart["subtotal"]) == float(target["price"])
        turn("Karachi delivery kitne din mein hogi? Agar policy nahi pata to bata do.")
        turn("Navy sneakers size 42 available hain?")
        unavailable, _ = turn("Navy sneakers size 42 ka ek pair cart mein daal do")
        assert unavailable["assistantMessage"]["intent"]["action"] != "add_to_cart"
        assert len(call("GET", f"/orders/carts/{cart_id}")["items"]) == 1
        print(
            "PASS: eight API turns, catalog filtering, cart, stock rejection, request replay",
            flush=True,
        )

        other = call("POST", "/auth/guest-session", json={"tenantSlug": args.slug})
        other_headers = {"Authorization": f"Bearer {other['accessToken']}"}
        assert client.get(f"/orders/carts/{cart_id}", headers=other_headers).status_code == 404
        assert (
            client.post(
                f"/conversations/{cid}/messages", json={"content": "hello"}, headers=other_headers
            ).status_code
            == 404
        )
        print("PASS: same-tenant different-customer isolation", flush=True)
        if args.allow_demo_order:
            order = call("POST", "/orders/checkout", json={"cartId": cart_id, "paymentMethod": "cod"})
            assert float(order["totalAmount"]) == float(target["price"])
            assert order["paymentStatus"] == "pending"
            assert (
                client.post("/orders/checkout", json={"cartId": cart_id, "paymentMethod": "cod"}).status_code
                == 422
            )
            assert client.get(f"/orders/{order['id']}", headers=other_headers).status_code == 404
            after = call("GET", f"/catalog/storefront/products/{target['id']}")
            assert after["stockQty"] == target["stockQty"] - 1
            print(
                "PASS: COD persistence, correct total, stock decrement, duplicate prevention; DEMO order:",
                order["id"],
                flush=True,
            )
        assert not fallback_turns, (
            f"AI quality check failed: {len(fallback_turns)} turns used fallback replies"
        )
        print("PASS: every non-transaction conversational reply was AI-generated", flush=True)


if __name__ == "__main__":
    main()
