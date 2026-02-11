from fastapi import APIRouter, Depends, HTTPException
import logging
logger = logging.getLogger(__name__)
from app.core.supabase import supabase_admin
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List, Dict
from app.api.deps import get_db
from app.models.core import RolePermission, UserProfile
from app.schemas.core import RolePermissionOut, PermissionToggle, UserRole
from app.core.security import check_permission, get_current_user
import uuid

# Canonical mapping for resource to module
RESOURCE_MODULE_MAP = {
    "users": "SYSTEM",
    "campaigns": "SYSTEM",
    "organizations": "SYSTEM",
    "roles_matrix": "SYSTEM",
    "audit_logs": "SYSTEM",
    "sales": "SALES",
    "goals": "SALES",
    "products": "PRODUCTS",
    "catalog": "PRODUCTS",
    "finance": "FINANCE",
    "payroll": "FINANCE",
    "metrics": "FINANCE",
    "history": "CHAT",
    "conversations": "CHAT",
    "scorecards": "QUALITY",
    "evaluations": "QUALITY",
    "commission_calculator": "ANALYTICS",
    "tournaments": "TOURNAMENTS",
    "battle": "TOURNAMENTS"
}

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
         raise HTTPException(
             status_code=403, 
             detail="Acceso denegado: Se requieren privilegios de Super Administrador para gestionar esta matriz."
         )
    return admin

@router.get("/", response_model=Dict[str, Dict[str, List[RolePermissionOut]]])
async def list_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("permissions", "view_tab", module="config"))
):
    """
    Returns the matrix grouped by Module -> Resource for the user's organization.
    """
    stmt = select(RolePermission).where(RolePermission.tenant_id == current_user.tenant_id)
    
    # --- REGLA DE JERARQUÍA: VISIBILIDAD LIMITADA ---
    # Normalización agresiva para evitar "fantasmas" (Super Admin vs super_admin)
    from app.schemas.user_schemas import UserRole
    current_role_norm = UserRole.normalize(str(current_user.role))
    
    if not current_user.is_super_admin:
        # Si no soy Super Admin, solo puedo ver los permisos asignados a mi propio rol.
        stmt = stmt.where(RolePermission.role == current_role_norm)
        
    result = await db.execute(stmt)
    perms = result.scalars().all()
    
    try:
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
    except Exception as e:
        logger.error(f"PERMISSIONS LIST ERROR: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener la matriz de permisos. ||| TECH_DETAILS: {str(e)}"
        )

@router.post("/toggle_status")
async def toggle_status(
    toggle: PermissionToggle,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("permissions", "view_tab", module="config"))
):
    """
    Updates the is_allowed value for a specific role, resource, and action.
    VALIDACIÓN CRÍTICA: Solo Super Admin puede definir las reglas.
    """
    # [SIMULATED SECURITY CHECK]
    # In this dev phase, we assume the requester is the admin
    
    from app.schemas.user_schemas import UserRole
    clean_role = UserRole.normalize(toggle.target_role)
    clean_module = toggle.module.lower() if toggle.module else None
    clean_resource = toggle.resource.lower()
    clean_action = toggle.action.lower()
    
    from sqlalchemy import func
    
    # CRITICAL FIX: Lookup by Unique Constraint (Role + Resource + Action + Tenant)
    filters = [
        RolePermission.role == clean_role,
        func.lower(RolePermission.resource) == clean_resource,
        func.lower(RolePermission.action) == clean_action,
        RolePermission.tenant_id == current_user.tenant_id
    ]
    
    if clean_module:
        filters.append(func.lower(RolePermission.module) == clean_module)

    query = select(RolePermission).where(*filters)
    
    result = await db.execute(query)
    permission = result.scalar_one_or_none()
    
    if not permission:
        # Create new permission record if missing
        permission = RolePermission(
            id=uuid.uuid4(),
            tenant_id=current_user.tenant_id,
            role=clean_role,
            resource=clean_resource,
            action=clean_action,
            module=clean_module or "system", # Use provided or default
            name=toggle.name,
            is_allowed=toggle.value
        )
        
        if not clean_module:
            # Try to infer module from existing permissions of the same resource (case-insensitive)
            mod_query = select(RolePermission.module).where(func.lower(RolePermission.resource) == clean_resource).limit(1)
            mod_res = await db.execute(mod_query)
            inferred_mod = mod_res.scalar_one_or_none()
            if inferred_mod:
                permission.module = inferred_mod.lower()
            else:
                # Fallback for known modules
                permission.module = RESOURCE_MODULE_MAP.get(clean_resource, "system").lower()
            
        db.add(permission)
    else:
        permission.is_allowed = toggle.value
        if toggle.name:
            permission.name = toggle.name
        if clean_module:
             permission.module = clean_module
        else:
             permission.module = permission.module.lower()
        
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"TOGGLE STATUS ERROR: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo guardar el cambio de permiso. ||| TECH_DETAILS: {str(e)}"
        )
    
    # Minimal response to avoid unnecessary overhead or potential DB reads
    return {"success": True, "message": "Updated"}

@router.get("/me")
async def get_my_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    """Retorna los permisos del usuario actual vía SQL"""
    # 1. Base response
    resp = {
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "role": current_user.role,
        "is_super_admin": current_user.is_super_admin,
        "permissions": {}
    }
    
    # 2. If Super Admin, they have everything
    if resp["is_super_admin"] or current_user.is_super_admin:
        return resp
    
    # 3. Fetch from DB
    try:
        stmt = select(RolePermission).where(
            RolePermission.role == current_user.role,
            RolePermission.tenant_id == current_user.tenant_id,
            RolePermission.is_allowed == True
        )
        result = await db.execute(stmt)
        perms = result.scalars().all()
        
        for p in perms:
            # Full Tri-factor key: module:resource:action
            full_key = f"{p.module}:{p.resource}:{p.action}"
            resp["permissions"][full_key] = True
            
            # Legacy Fallback key: resource:action (for older components)
            legacy_key = f"{p.resource}:{p.action}"
            resp["permissions"][legacy_key] = True
            
    except Exception as e:
        logger.error(f"Error fetching permissions via SQL: {e}", exc_info=True)
        
    return resp
