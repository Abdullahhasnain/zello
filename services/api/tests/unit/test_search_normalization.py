"""Unit tests for Roman Urdu / Urdu / English query normalization —
app/modules/search/normalization.py. Pure functions, no database, no
network — the whole point of keeping this logic out of SearchService."""

from app.modules.search.normalization import detect_language, normalize_query


def test_detects_urdu_script() -> None:
    assert detect_language("مجھے سرخ جوتے چاہیے") == "urdu"


def test_detects_roman_urdu_by_marker_vocabulary() -> None:
    assert detect_language("mujhe sasta joota chahiye") == "roman_urdu"
    assert detect_language("yeh kitna hai") == "roman_urdu"


def test_detects_english_when_no_urdu_signal_present() -> None:
    assert detect_language("show me red shoes under 3000") == "english"


def test_urdu_script_passes_through_unchanged() -> None:
    text = "مجھے سرخ جوتے چاہیے"
    assert normalize_query(text) == text


def test_normalizes_common_roman_urdu_spelling_variants() -> None:
    assert normalize_query("mujhe sasata joota chaiye") == "mujhe sasta joota chahiye"
    assert normalize_query("achha rung wala kapray dikha") == "acha rang wala kapre dikhao"


def test_normalization_is_case_insensitive_and_collapses_whitespace() -> None:
    assert normalize_query("  SASATA   Joota  ") == "sasta joota"


def test_english_query_passes_through_lowercased() -> None:
    assert normalize_query("Red Shoes Size 42") == "red shoes size 42"


def test_empty_query_normalizes_to_empty_string() -> None:
    assert normalize_query("   ") == ""
