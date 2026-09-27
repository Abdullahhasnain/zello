import pytest

from app.modules.conversations.router import _references_recent_products


@pytest.mark.parametrize(
    "text",
    [
        "In options ko price aur available features ke hisaab se compare karo.",
        "In options mein meri zaroorat aur budget ke liye kaunsa behtar hai?",
        "Recommend one of these",
    ],
)
def test_sales_followups_reuse_real_recommendations(text):
    assert _references_recent_products(text)
