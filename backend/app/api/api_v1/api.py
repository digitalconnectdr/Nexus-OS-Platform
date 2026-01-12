from fastapi import APIRouter

# --- 1. IMPORTAMOS LOS ARCHIVOS (ENCHUFES) ---
from app.api.api_v1.endpoints.sales import router as sales_router
from app.api.api_v1.endpoints.organizations import router as organizations_router
from app.api.api_v1.endpoints.products import router as products_router
from app.api.api_v1.endpoints.campaigns import router as campaigns_router
from app.api.api_v1.endpoints.users import router as users_router
from app.api.api_v1.endpoints.statuses import router as statuses_router
from app.api.api_v1.endpoints.goals import router as goals_router
from app.api.api_v1.endpoints.permissions import router as permissions_router
from app.api.api_v1.endpoints.auth import router as auth_router

# ESTE ES EL NUEVO (Tu archivo operational.py)
from app.api.api_v1.endpoints.operational import router as operational_router
from app.api.api_v1.endpoints.analytics import router as analytics_router
from app.api.api_v1.endpoints.campaign_performance import router as campaign_performance_router

api_router = APIRouter()

# --- 2. CONECTAMOS LOS CABLES (RUTAS) ---
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(sales_router, prefix="/sales", tags=["sales"])
api_router.include_router(organizations_router, prefix="/organizations", tags=["organizations"])
api_router.include_router(products_router, prefix="/products", tags=["products"])
api_router.include_router(campaigns_router, prefix="/campaigns", tags=["campaigns"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(statuses_router, prefix="/statuses", tags=["statuses"])
api_router.include_router(goals_router, prefix="/goals", tags=["goals"])
api_router.include_router(permissions_router, prefix="/permissions", tags=["permissions"])

# ¡AQUÍ ESTÁ LA CLAVE! Sin esta línea, sale 404.
api_router.include_router(operational_router, prefix="/results", tags=["results"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(campaign_performance_router, prefix="/campaign-performance", tags=["campaign-performance"])