import pytest

from app.modules.conversations.router import _references_recent_products


@pytest.mark.parametrize(
    "message",
    [
        "ye wala available hai?",
        "show me something cheaper",
        "is this available in size 42?",
        "یہ والا موجود ہے؟",
    ],
)
def test_recognizes_product_follow_up_language(message: str) -> None:
    assert _references_recent_products(message) is True


def test_new_product_request_is_not_forced_to_previous_results() -> None:
    assert _references_recent_products("mujhe black shoes chahiye") is False
