"""Composes the assistant's reply text for a search-backed conversation
turn. Deliberately templated, not generative — every sentence is built
from the actual search result set, so the assistant can never state a
product, price, or count that doesn't exist. A generative (LLM-authored)
reply is the Conversation Orchestrator's job, not built here — see the
SRS's phased-delivery section and app/modules/conversations/service.py's
module docstring for why that boundary is where it is.
"""

import re
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from app.domain.entities.product import Product

_NO_RESULTS = {
    "english": "Sorry, I couldn't find anything matching '{query}'. Could you describe it differently?",
    "roman_urdu": (
        "Maaf kijiye, '{query}' se milta koi product nahi mila. Kya aap alag tareeqe se bata sakte hain?"
    ),
    "urdu": "معذرت، '{query}' سے ملتا کوئی پروڈکٹ نہیں ملا۔ کیا آپ مختلف طریقے سے بتا سکتے ہیں؟",
}

_RESULTS_HEADER = {
    "english": "I found {count} product(s) matching '{query}':",
    "roman_urdu": "Mujhe '{query}' se milte {count} products mile hain:",
    "urdu": "مجھے '{query}' سے ملتے {count} پروڈکٹس ملے ہیں:",
}

_PRICE_LINE = {
    "english": "{title} — {price}",
    "roman_urdu": "{title} — {price}",
    "urdu": "{title} — {price}",
}

_DEFAULT_GREETING = {
    "english": "Hello! I'm your shopping assistant. How can I help you today?",
    "roman_urdu": "Assalam o Alaikum! Main Zello hoon. Aap kya dhoond rahe hain?",
    "urdu": "السلام علیکم! میں Zello AI ہوں۔ آج میں آپ کی کیا مدد کر سکتا ہوں؟",
}

_DEFAULT_LANGUAGE = "english"

# A deterministic safety gate for mutations. The planner can select a
# product, but it cannot by itself authorise a cart write.
_CART_REQUEST = re.compile(
    r"(?:\b(?:add|put)\b.*\b(?:cart|basket)\b|\b(?:cart|basket)\b.*\b(?:add|put)\b|"
    r"\b(?:buy|purchase)\s+(?:this|it|that|one)\b|"
    r"\b(?:cart\s*(?:me|mein)\s*)?(?:daal|dal|dalo|daalo)\b|"
    r"\badd\s*(?:kar|karo|kardo|kar do)\b|"
    r"\b(?:kharidna|kharid)\s+(?:hai|hain)\b|"
    r"(?:کارٹ|ٹوکری).*(?:ڈال|شامل)|(?:ڈال|شامل).*(?:کارٹ|ٹوکری)|"
    r"(?:خریدنا|خرید).*(?:ہے|ہیں))",
    re.IGNORECASE,
)
_CART_NEGATION = re.compile(
    r"\b(?:not|don't|dont|never|nahi|nahin|mat|how|kaise)\b|نہیں|مت|کیسے",
    re.IGNORECASE,
)
_CART_QUANTITY = re.compile(r"\b(\d{1,2})\s*(?:x|piece|pieces|pc|pcs)\b", re.IGNORECASE)


def format_price(amount: Decimal | float | int | str, currency: str = "$") -> str:
    """Return a customer-safe price without database precision noise.

    Catalog values are stored as ``Decimal`` values, but using their default
    string representation can leak trailing zeroes into chat replies and LLM
    context. Convert through ``str`` so a float is never formatted through its
    binary representation, then render whole amounts without a decimal part.
    """
    try:
        value = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("Price must be a finite numeric amount") from exc

    if not value.is_finite():
        raise ValueError("Price must be a finite numeric amount")

    if value == value.to_integral_value():
        rendered = f"{value:,.0f}"
    else:
        rendered = f"{value:,.2f}"

    normalized_currency = currency.strip()
    if not normalized_currency:
        return rendered
    if normalized_currency in {"$", "£", "€"}:
        return f"{normalized_currency}{rendered}"
    return f"{normalized_currency} {rendered}"


def is_cart_request(text: str) -> bool:
    """Recognise an explicit request to buy/add, never a hypothetical question."""
    return bool(_CART_REQUEST.search(text)) and not bool(_CART_NEGATION.search(text))


def extract_cart_quantity(text: str) -> int:
    """Return an explicitly spoken quantity, bounded by the cart API limit."""
    match = _CART_QUANTITY.search(text)
    if not match:
        return 1
    return min(max(int(match.group(1)), 1), 20)


def compose_greeting(language: str, persona: str | None) -> str:
    """`persona` is the tenant's own greeting text, set in Widget Studio
    (Tenant.branding.greetingPersona) — used verbatim when present, since
    that's the whole point of letting a store owner customize it. Falls
    back to a sensible per-language default otherwise."""
    if persona:
        return persona
    lang = language if language in _DEFAULT_GREETING else _DEFAULT_LANGUAGE
    return _DEFAULT_GREETING[lang]


def compose_search_reply(language: str, query: str, products: list[Product]) -> str:
    lang = language if language in _NO_RESULTS else _DEFAULT_LANGUAGE

    if not products:
        return _NO_RESULTS[lang].format(query=query)

    header = _RESULTS_HEADER[lang].format(count=len(products), query=query)
    lines = [
        _PRICE_LINE[lang].format(
            title=p.title,
            price=format_price(p.price, p.currency),
        )
        for p in products
    ]
    return "\n".join([header, *lines])


def compose_comparison_reply(language: str, products: list[Product]) -> str:
    """Factual fallback when the LLM is unavailable during a comparison."""
    if len(products) < 2:
        return compose_search_reply(language, "comparison", products)

    first, second = products[:2]
    first_price = format_price(first.price, first.currency)
    second_price = format_price(second.price, second.currency)
    if language == "roman_urdu":
        return (
            f"Quick comparison: {first.title} {first_price} ka hai, jabke {second.title} "
            f"{second_price} ka hai. Dono ke available features aur stock cards mein dikh rahe hain. "
            "Aap chahein to main aap ki zaroorat ke hisaab se ek recommend kar doon."
        )
    if language == "urdu":
        return (
            f"فوری موازنہ: {first.title} کی قیمت {first_price} ہے جبکہ {second.title} کی قیمت "
            f"{second_price} ہے۔ دونوں کی خصوصیات اور اسٹاک کارڈز میں موجود ہیں۔"
        )
    return (
        f"Quick comparison: {first.title} is {first_price}, while {second.title} is {second_price}. "
        "Their available features and stock are shown in the cards. I can recommend one for your needs."
    )


def compose_cart_confirmation(language: str, product: Product, quantity: int) -> str:
    """Speak a factual cart receipt only after the cart service succeeds."""
    item = product.title if quantity == 1 else f"{quantity} × {product.title}"
    if language == "roman_urdu":
        return f"Main ne {item} aapki cart mein add kar diya hai. Kya aap cart review karna chahenge?"
    if language == "urdu":
        return f"میں نے {item} آپ کے کارٹ میں شامل کر دیا ہے۔ کیا آپ کارٹ دیکھنا چاہیں گے؟"
    return f"I've added {item} to your cart. Would you like to review it or proceed to checkout?"
