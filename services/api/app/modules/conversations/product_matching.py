"""Exact size/colour checks after semantic retrieval; unknown is not a match."""

import re

from app.domain.entities.product import Product, ProductStatus

_COLORS = {
    "kala": "black",
    "kaala": "black",
    "کالا": "black",
    "سیاہ": "black",
    "safed": "white",
    "سفید": "white",
    "neela": "blue",
    "نیلا": "blue",
    "navy blue": "navy",
    "bhura": "brown",
    "بھورا": "brown",
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


def _normal(value: object) -> str:
    text = str(value).strip().lower()
    return _COLORS.get(text, text)


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
