"""Composes the assistant's reply text for a search-backed conversation
turn. Deliberately templated, not generative — every sentence is built
from the actual search result set, so the assistant can never state a
product, price, or count that doesn't exist. A generative (LLM-authored)
reply is the Conversation Orchestrator's job, not built here — see the
SRS's phased-delivery section and app/modules/conversations/service.py's
module docstring for why that boundary is where it is.
"""

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
    "english": "{title} — {currency} {price}",
    "roman_urdu": "{title} — {currency} {price}",
    "urdu": "{title} — {currency} {price}",
}

_DEFAULT_GREETING = {
    "english": "Hello! I'm your shopping assistant. How can I help you today?",
    "roman_urdu": "Assalam o Alaikum! Main Zello AI hoon. Aaj main aapki kya madad kar sakta hoon?",
    "urdu": "السلام علیکم! میں Zello AI ہوں۔ آج میں آپ کی کیا مدد کر سکتا ہوں؟",
}

_DEFAULT_LANGUAGE = "english"


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
        _PRICE_LINE[lang].format(title=p.title, currency=p.currency, price=p.price) for p in products
    ]
    return "\n".join([header, *lines])
