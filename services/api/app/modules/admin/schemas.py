from app.modules.conversations.schemas import ConversationRead
from app.modules.tenants.schemas import TenantRead

# Re-exported so admin router imports read `from app.modules.admin.schemas import ...`
# rather than reaching into other modules' schema files directly.
__all__ = ["ConversationRead", "TenantRead"]
