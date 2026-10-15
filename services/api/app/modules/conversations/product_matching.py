"""Exact size/colour checks after semantic retrieval; unknown is not a match."""

import re

from app.domain.entities.product import Product, ProductStatus

_COLORS = {
    "black": "black",
    "kala": "black",
    "kaala": "black",
    "کالا": "black",
    "سیاہ": "black",
    "safed": "white",
    "سفید": "white",
    "neela": "blue",
    "نیلا": "blue",
    "navy blue": "navy",
    "navy": "navy",
    "blue": "blue",
    "brown": "brown",
    "bhura": "brown",
    "بھورا": "brown",
}

_QUERY_ALIASES = {
    "kale": "black",
    "kaale": "black",
    "kali": "black",
    "jootay": "shoes",
    "joota": "shoes",
    "sneaker": "sneakers",
    "saste": "cheap",
}

_CATEGORIES = {
    "shoes": ("shoes", "sneakers", "joota", "جوتے"),
    "sneakers": ("sneakers",),
    "shirts": ("shirt", "shirts", "t-shirt", "قمیض"),
    "shirt": ("shirt", "shirts", "t-shirt", "قمیض"),
    "jeans": ("jeans", "denim"),
    "bags": ("bag", "backpack"),
    "kurta": ("kurta", "kurtas", "کرتا"),
}

_COMPARISON_INTENT = re.compile(
    r"\b(compare|comparison|versus|vs\.?|which\s+(?:one|is)\s+(?:better|best)|"
    r"(?:kaunsa|konsa|kon\s*sa)\s+(?:behtar|best)|farq|difference|"
    r"(?:ya|or)\b.*\b(?:kaunsa|konsa|which|better|loon|lena))\b|"
    r"میں\s*سے\s*کون\s*سا|موازنہ",
    re.IGNORECASE,
)

_COMPARISON_SPLIT = re.compile(
    r"(?:compare|comparison|which\s+one\s+is\s+better\s+between|"
    r"kaunsa\s+behtar\s+hai\s+between|konsa\s+behtar\s+hai\s+between)\s+"
    r"(?P<left>.+?)\s+(?:and|or|ya|vs\.?|versus)\s+(?P<right>.+?)(?:[?.!]|$)",
    re.IGNORECASE,
)

# Covers the natural form "Product A ya Product B me se konsa loon?" as
# well as a simple "Product A vs Product B".  It is only used after the
# intent detector has identified a comparison, so ordinary search queries do
# not get split merely because they contain "and".
_DIRECT_COMPARISON_SPLIT = re.compile(
    r"(?P<left>.+?)\s+(?:and|or|ya|vs\.?|versus)\s+(?P<right>.+?)"
    r"(?:\s+(?:me|mein)\s+se\s+(?:kaunsa|konsa|which|better|loon|lena).*)?"
    r"(?:[?.!]|$)",
    re.IGNORECASE,
)


def is_comparison_intent(text: str) -> bool:
    """Recognise explicit English, Roman Urdu, and Urdu comparison requests."""
    return bool(_COMPARISON_INTENT.search(text))


def extract_comparison_terms(text: str) -> tuple[str, str] | None:
    """Extract two catalog-searchable names from a direct comparison request.

    A request such as "compare options" intentionally returns ``None``; in
    that case the router compares the two products from the current catalog
    context instead of guessing names that the customer did not say.
    """
    compact = " ".join(text.split())
    match = _COMPARISON_SPLIT.search(compact)
    if not match and is_comparison_intent(compact):
        match = _DIRECT_COMPARISON_SPLIT.search(compact)
    if not match:
        return None
    left = re.sub(
        r"^(?:compare(?:\s+between)?|comparison(?:\s+between)?|"
        r"which\s+one\s+is\s+better\s+between)\s+",
        "",
        match.group("left"),
        flags=re.IGNORECASE,
    ).strip(" ,:-")
    right = re.sub(
        r"\s+(?:me|mein)\s+se\s+(?:kaunsa|konsa|which|better|loon|lena).*?$",
        "",
        match.group("right"),
        flags=re.IGNORECASE,
    ).strip(" ,:-")
    return (left, right) if left and right else None


def match_comparison_products(query: str, products: list[Product]) -> list[Product]:
    """Return up to two real catalog products for a comparison turn.

    Full product-title mentions win. If the customer says "compare options",
    preserve the current catalog order and take the first two real products
    already shown to them. Archived records are never surfaced.
    """
    active = [product for product in products if product.status != ProductStatus.ARCHIVED]
    if not active:
        return []

    normalized_query = _comparison_text(query)
    scored: list[tuple[int, int, Product]] = []
    for index, product in enumerate(active):
        title = _comparison_text(product.title)
        title_tokens = {token for token in title.split() if len(token) > 2 and token != "demo"}
        if title and title in normalized_query:
            scored.append((len(title_tokens) + 100, index, product))
            continue
        overlap = len(title_tokens & set(normalized_query.split()))
        if overlap >= 2:
            scored.append((overlap, index, product))

    if scored:
        scored.sort(key=lambda item: (-item[0], item[1]))
        return [product for _, _, product in scored[:2]]
    return active[:2]


def _comparison_text(value: str) -> str:
    return re.sub(r"[^\w\s]", " ", value.casefold()).replace("_", " ")


def _normal(value: object) -> str:
    text = str(value).strip().lower()
    return _COLORS.get(text, text)


def extract_explicit_preferences(text: str) -> dict[str, str]:
    """Deterministic attributes stated by a shopper.

    These are used as hard filters after semantic retrieval: a vector match
    must never turn an explicit request for black, size 42 shoes into brown
    formal shoes. The LLM can still add richer preferences, but it cannot
    erase a literal colour/size/category the shopper supplied.
    """
    normalized = _comparison_text(text)
    result: dict[str, str] = {}
    for alias, canonical in _QUERY_ALIASES.items():
        normalized = re.sub(rf"\b{re.escape(alias)}\b", canonical, normalized)
    for spoken, canonical in _COLORS.items():
        if re.search(rf"\b{re.escape(spoken)}\b", normalized):
            result["color"] = canonical
            break
    size = re.search(r"\b(?:size\s*)?(?:eu\s*)?(3[6-9]|4[0-8])\b", normalized)
    if size:
        result["size"] = size.group(1)
    for category, terms in _CATEGORIES.items():
        if any(re.search(rf"\b{re.escape(term)}\b", normalized) for term in terms):
            result["category"] = category
            break
    return result


def matches_preferences(product: Product, preferences: dict) -> bool:
    if product.status == ProductStatus.ARCHIVED:
        return False
    attributes = {str(k).lower(): v for k, v in product.attributes.items()}
    category = _normal(preferences.get("category", ""))
    if category in _CATEGORIES:
        text = f"{product.title} {attributes.get('category', '')}".lower()
        if not any(re.search(rf"\b{re.escape(term)}\b", text) for term in _CATEGORIES[category]):
            return False
    for name in ("color", "size"):
        wanted = preferences.get(name)
        if not wanted:
            continue
        wanted = _normal(wanted)
        value = attributes.get(name, attributes.get("colour") if name == "color" else None)
        if value is not None:
            values = value if isinstance(value, list) else [value]
            if wanted not in {_normal(v) for v in values}:
                return False
        elif name == "size":
            text = f"{product.title} {product.description or ''}".lower()
            sizes = re.findall(r"(?:size|سائز)\s*(?:eu\s*)?([\w.]+)", text)
            if wanted.removeprefix("eu ") not in sizes:
                return False
        elif not re.search(rf"\b{re.escape(wanted)}\b", product.title.lower()):
            return False
    return True
