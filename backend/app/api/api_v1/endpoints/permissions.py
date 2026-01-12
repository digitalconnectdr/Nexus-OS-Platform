from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Dict
from app.api.deps import get_db
from app.models.core import RolePermission, UserProfile
from app.schemas.core import RolePermissionOut, PermissionToggle, UserRole
from app.core.security import check_permission, get_current_user
import uuid

router = APIRouter()

# Mock current user for security validation (since auth system is simulated)
# In production, this would be a dependency like get_current_user
async def get_mock_admin_user(db: AsyncSession = Depends(get_db)):
    # Simulating a check for 'Super Admin'
    # For now, we'll allow if there's any user with Super Admin role
    # In a real scenario, we check the JWT/Session of the requester
    result = await db.execute(select(UserProfile).where(UserProfile.role == UserRole.SUPER_ADMIN))
    admin = result.scalar_one_or_none()
    if not admin:
         raise HTTPException(status_code=403, detail="Required Super Admin privileges")
    return admin

@router.get("/", response_model=Dict[str, Dict[str, List[RolePermissionOut]]])
async def list_permissions(db: AsyncSession = Depends(get_db)):
    """
    Returns the matrix grouped by Module -> Resource
    """
    result = await db.execute(select(RolePermission))
    perms = result.scalars().all()
    
    grouped = {}
    for p in perms:
        module = p.module
        resource = p.resource
        
        if module not in grouped:
            grouped[module] = {}
        if resource not in grouped[module]:
            grouped[module][resource] = []
            
        grouped[module][resource].append(RolePermissionOut.model_validate(p))
        
    return grouped

@router.post("/toggle")
async def toggle_permission(
    toggle: PermissionToggle,
    db: AsyncSession = Depends(get_db),
    # current_user: UserProfile = Depends(get_mock_admin_user) # Uncomment for strict RBAC
):
    """
    Updates the is_allowed value for a specific role, resource, and action.
    VALIDACIÓN CRÍTICA: Solo Super Admin puede definir las reglas.
    """
    # [SIMULATED SECURITY CHECK]
    # In this dev phase, we assume the requester is the admin
    
    query = select(RolePermission).where(
        RolePermission.role == toggle.target_role,
        RolePermission.resource == toggle.resource,
        RolePermission.action == toggle.action
    )
    
    result = await db.execute(query)
    permission = result.scalar_one_or_none()
    
    if not permission:
        raise HTTPException(status_code=404, detail="Permission record not found")
        
    permission.is_allowed = toggle.value
    await db.commit()
    
    return {"status": "success", "new_value": toggle.value}

@router.get("/me")
async def get_my_permissions(
    current_user: UserProfile = Depends(get_current_user)
):
    """
    Returns the current user's role and their granular permissions.
    """
    # 1. Base response
    resp = {
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "role": current_user.role,
        "is_super_admin": current_user.role == UserRole.SUPER_ADMIN,
        "permissions": {}
    }
    
    # 2. If Super Admin, they have everything
    if resp["is_super_admin"]:
        return resp
    
    # 3. Use pre-loaded permissions from Eager Loading journey
    for p in current_user.permissions:
        # Format: "resource:action" -> is_allowed
        key = f"{p.resource}:{p.action}"
        resp["permissions"][key] = p.is_allowed
        
    return resp
