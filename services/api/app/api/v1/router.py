from fastapi import APIRouter

from app.modules.admin.router import router as admin_router
from app.modules.analytics.router import router as analytics_router
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.catalog.router import router as catalog_router
from app.modules.conversations.router import router as conversations_router
from app.modules.orders.router import router as orders_router
from app.modules.search.router import router as search_router
from app.modules.tenants.router import admin_router as tenants_admin_router
from app.modules.tenants.router import router as tenants_router
from app.modules.users.router import router as users_router
from app.modules.voice.router import router as voice_router

# Single composition point: every module's router is mounted here, and only
# here — main.py just includes this one router. Adding a module means
# adding one line in this file, not touching main.py.
api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(tenants_router)
api_router.include_router(users_router)
api_router.include_router(catalog_router)
api_router.include_router(search_router)
api_router.include_router(conversations_router)
api_router.include_router(orders_router)
api_router.include_router(billing_router)
api_router.include_router(analytics_router)
api_router.include_router(voice_router)

# Admin-only surfaces, grouped under /admin for a single point to apply
# stricter infra-level controls (e.g. an API gateway rule) if needed later.
api_router.include_router(tenants_admin_router)
api_router.include_router(admin_router)
