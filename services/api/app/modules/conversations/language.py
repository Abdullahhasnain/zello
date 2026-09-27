"""Keep response script stable even when speech recognition changes script."""

import re

from app.modules.search.normalization import detect_language


def response_language(text: str, prior: str) -> str:
    normalized = text.strip().lower().rstrip(".!؟?")
    # Deliberate language requests, not a product name or short STT result.
    patterns = (
        (
            "roman_urdu",
            r"(?:please )?(?:reply in roman urdu|roman urdu mein (?:baat karo|jawab do|bolo)"
            r"|رومن اردو میں (?:جواب دو|بات کرو))",
        ),
        (
            "english",
            r"(?:please )?(?:reply in english|speak english|english mein (?:baat karo|jawab do|bolo)"
            r"|انگریزی میں (?:جواب دو|بات کرو))",
        ),
        (
            "urdu",
            r"(?:please )?(?:reply in urdu|urdu mein (?:baat karo|jawab do|bolo)"
            r"|اردو میں (?:جواب دو|بات کرو))",
        ),
    )
    for language, pattern in patterns:
        if re.fullmatch(pattern, normalized):
            return language
    return prior if prior in ("roman_urdu", "urdu", "english") else detect_language(text)
