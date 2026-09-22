"""Query text normalization for Roman Urdu / Urdu / English search queries.

This is deliberately lightweight — a spelling-variant canonicalizer and a
script/language detector, not a full NLU pipeline (that's the Conversation
Orchestrator's job, not built here — see the SRS's phased delivery
section). Embedding models handle a fair amount of spelling variance on
their own; normalizing the most common Roman Urdu variants before
embedding closes the gap further for e-commerce shopping vocabulary
specifically, where the same word shows up spelled a dozen ways across
real customer messages.
"""

import re
from typing import Literal

Language = Literal["urdu", "roman_urdu", "english"]

# Canonical form <- every spelling variant seen in Pakistani e-commerce
# chat logs for that word. Keys are variants, values are the canonical
# spelling every variant collapses to before embedding.
_ROMAN_URDU_VARIANTS: dict[str, str] = {
    # chahiye (want/need)
    "chahye": "chahiye",
    "chaiye": "chahiye",
    "chahyeh": "chahiye",
    "chahiyeh": "chahiye",
    # sasta (cheap)
    "sasata": "sasta",
    "sasti": "sasta",
    "sastay": "sasta",
    # acha (good)
    "achha": "acha",
    "acha": "acha",
    "achaa": "acha",
    # rang (color)
    "rung": "rang",
    "rangat": "rang",
    # kapre (clothes)
    "kapray": "kapre",
    "kapde": "kapre",
    "kapra": "kapre",
    # joota (shoes)
    "jota": "joota",
    "juta": "joota",
    "jute": "joota",
    "jootay": "joota",
    # qeemat (price)
    "qimat": "qeemat",
    "keemat": "qeemat",
    "keimat": "qeemat",
    # wala (the one with / seller of)
    "vala": "wala",
    "waala": "wala",
    "vaala": "wala",
    # size
    "saeez": "size",
    "sauz": "size",
    # mobile
    "mobail": "mobile",
    "mobile": "mobile",
    # dikhao (show me)
    "dikhaon": "dikhao",
    "dikha": "dikhao",
    "dikhado": "dikhao",
    # bhejna (send)
    "bhejo": "bhejna",
    "bhej": "bhejna",
}

_URDU_SCRIPT_PATTERN = re.compile(r"[؀-ۿݐ-ݿ]")
_WHITESPACE_PATTERN = re.compile(r"\s+")

# A handful of very common Roman Urdu function words — enough to
# distinguish "kitna hai yeh" from an English sentence without needing a
# full lexicon. Extend this list as real query logs surface more.
_ROMAN_URDU_MARKERS = frozenset(
    {
        "hai",
        "hain",
        "ka",
        "ki",
        "ke",
        "mein",
        "kya",
        "kaise",
        "kitna",
        "kitne",
        "chahiye",
        "acha",
        "sasta",
        "wala",
        "aap",
        "mujhe",
        "hum",
        "kar",
        "karo",
        "diko",
        "dikhao",
    }
)


def detect_language(text: str) -> Language:
    """Script wins first: any Arabic-range character means Urdu, full
    stop — Roman Urdu and English share the Latin alphabet, so that
    distinction can only come from vocabulary, checked next."""
    if _URDU_SCRIPT_PATTERN.search(text):
        return "urdu"

    tokens = _tokenize(text)
    if any(token in _ROMAN_URDU_MARKERS for token in tokens):
        return "roman_urdu"

    return "english"


def normalize_query(text: str) -> str:
    """Lowercases, collapses whitespace, and canonicalizes known Roman
    Urdu spelling variants. Urdu-script text passes through untouched —
    canonicalizing Arabic-script spelling isn't the problem this solves;
    the embedding model's own multilingual training handles that script
    natively far better than a hand-maintained substitution table could."""
    if detect_language(text) == "urdu":
        return text.strip()

    tokens = _tokenize(text)
    normalized_tokens = [_ROMAN_URDU_VARIANTS.get(token, token) for token in tokens]
    return " ".join(normalized_tokens)


def _tokenize(text: str) -> list[str]:
    cleaned = _WHITESPACE_PATTERN.sub(" ", text.strip().lower())
    return cleaned.split(" ") if cleaned else []
