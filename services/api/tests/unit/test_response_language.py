import pytest

from app.modules.conversations.language import response_language


@pytest.mark.parametrize("text", ["کیجول", "سائز بیالیس", "casual", "mujhe black shoes chahiye"])
def test_roman_urdu_survives_transcription_script(text):
    assert response_language(text, "roman_urdu") == "roman_urdu"


@pytest.mark.parametrize("prior", ["english", "urdu", "roman_urdu"])
def test_preserve_selected_language(prior):
    assert response_language("کیجول", prior) == prior


@pytest.mark.parametrize(
    "text,expected",
    [
        ("English mein jawab do", "english"),
        ("Roman Urdu mein baat karo", "roman_urdu"),
        ("اردو میں جواب دو", "urdu"),
        ("Please reply in English.", "english"),
    ],
)
def test_explicit_switch(text, expected):
    assert response_language(text, "roman_urdu") == expected


def test_product_mention_is_not_language_switch():
    assert response_language("English brand shoes dikhao", "roman_urdu") == "roman_urdu"
