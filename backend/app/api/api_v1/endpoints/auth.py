from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db
from app.core.security import get_current_user
from app.models.core import UserProfile, RolePermission, Organization
from app.schemas.core import BootstrapResponse
from typing import Dict, List, Optional

router = APIRouter()

@router.get("/bootstrap", response_model=BootstrapResponse)
async def bootstrap(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Unified endpoint to retrieve all necessary data for application startup.
    Reduces network roundtrips and prevents UI flickering.
    """
    # 1. Fetch permissions for the user's role
    role_str = str(current_user.role.value) if hasattr(current_user.role, 'value') else str(current_user.role)
    perm_query = select(RolePermission).where(RolePermission.role == role_str)
    perm_result = await db.execute(perm_query)
    perms = perm_result.scalars().all()
    
    permissions_map = {}
    for p in perms:
        # Tri-factor key: module:resource:action (Always Lowercase for stability)
        mod_key = str(p.module).lower() if p.module else "none"
        res_key = str(p.resource).lower()
        act_key = str(p.action).lower()
        
        full_key = f"{mod_key}:{res_key}:{act_key}"
        permissions_map[full_key] = p.is_allowed
        
        # Legacy fallback key: resource:action
        legacy_key = f"{res_key}:{act_key}"
        permissions_map[legacy_key] = p.is_allowed
        
    # 2. Fetch tenant info
    tenant = None
    if current_user.tenant_id:
        tenant_query = select(Organization).where(Organization.id == current_user.tenant_id)
        tenant_result = await db.execute(tenant_query)
        tenant = tenant_result.scalar_one_or_none()
        
    return {
        "user": current_user,
        "permissions": permissions_map,
        "tenant": tenant,
        "roles": [current_user.role] if current_user.role else []
    }
