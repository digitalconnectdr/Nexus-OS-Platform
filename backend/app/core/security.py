from fastapi import Depends, HTTPException, status, Header, Request
from typing import Optional
import logging
logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.api.deps import get_db, set_session_tenant
from app.models.core import UserProfile, RolePermission
from app.schemas.core import UserRole
from app.core.config import settings
from supabase import create_client, Client
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uuid

from app.core.supabase import supabase_admin
import asyncio
import jwt

security = HTTPBearer()

# Definición de Jerarquía (Mayor número = Mayor poder)
ROLE_HIERARCHY = {
    UserRole.SUPER_ADMIN: 100,
    UserRole.ADMINISTRADOR: 90,
    UserRole.CLIENTE: 85,
    UserRole.GERENTE: 80,
    UserRole.SUPERVISOR_SENIOR: 70,
    UserRole.SUPERVISOR: 60,
    UserRole.DPTO_ESTADISTICA: 50,
    UserRole.AUDITOR_CALIDAD: 50,
    UserRole.SEGUIMIENTO: 40,
    UserRole.DIGITACION: 30,
    UserRole.REPRESENTANTE: 10
}

def get_role_level(role_name: str) -> int:
    """Devuelve el nivel numérico del rol. Default 0 si no existe."""
    if not role_name:
        return 0
    # Normalize for lookup
    from app.schemas.user_schemas import UserRole
    norm = UserRole.normalize(role_name)
    
    # Try to look up by Enum member first if possible, otherwise by string
    # Because ROLE_HIERARCHY keys are Enum members
    try:
        enum_role = UserRole(norm)
        return ROLE_HIERARCHY.get(enum_role, 0)
    except ValueError:
        # If not in enum, try direct string lookup (fallback)
        return ROLE_HIERARCHY.get(norm, 0)

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    auth: HTTPAuthorizationCredentials = Depends(security),
    x_tenant_id: Optional[str] = Header(None)
) -> UserProfile:
    """ Validates the Supabase JWT and returns the DB UserProfile. """
    token = auth.credentials
    
    # 1. LOCAL JWT VALIDATION (High Performance)
    try:
        # Supabase uses HS256 with the JWT Secret
        payload = jwt.decode(
            token, 
            settings.SUPABASE_JWT_SECRET, 
            algorithms=["HS256"],
            options={"verify_aud": False},
            leeway=60
        )
        supabase_id = payload.get("sub")
        if not supabase_id:
            raise HTTPException(status_code=401, detail="Token inválido: ID de usuario no encontrado")
            
    except jwt.PyJWTError as e:
        logger.warning(f"🔐 Local JWT Validation Failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail=f"Sesión inválida o expirada: {str(e)}"
        )

    # 2. DB FETCH (Local DB)
    if db:
        try:
            # We fetch directly from Local DB using the sub (ID from Supabase)
            result = await db.execute(
                select(UserProfile)
                .where(UserProfile.id == uuid.UUID(supabase_id))
            )
            db_user = result.scalar_one_or_none()
            
            if db_user:
                # 3. TENANT OVERRIDE (Super Admin Context Switching)
                current_tenant_id = str(db_user.tenant_id)
                if db_user.is_super_admin and x_tenant_id:
                    try:
                        clean_tenant_id = x_tenant_id.strip('"').strip("'")
                        uuid_obj = uuid.UUID(clean_tenant_id)
                        current_tenant_id = str(uuid_obj)
                        # CRITICAL FIX: Update in-memory ONLY. 
                        # We modify __dict__ to bypass SQLAlchemy dirty tracking so this change 
                        # is NOT persisted to the DB on commit, preventing FK errors or unwanted saves.
                        db_user.__dict__['tenant_id'] = uuid_obj 
                        print(f"🔄 CONTEXT SWITCH (Session Only): {db_user.email} -> {current_tenant_id}")
                    except ValueError: 
                        print(f"⚠️ Invalid x-tenant-id header ignored: {x_tenant_id}")
                        logger.warning(f"⚠️ Invalid x-tenant-id header ignored: {x_tenant_id}")
                
                await set_session_tenant(db, current_tenant_id)
                return db_user
            else:
                logger.error(f"❌ [AUTH ERROR] Profile NOT found in table 'users_profiles' for ID: {supabase_id}")
                raise HTTPException(status_code=401, detail="Perfil de usuario no registrado en el sistema local")
        except HTTPException: raise
        except Exception as db_e:
            logger.error(f"⚠️ Local DB Fetch Error: {db_e}")
            raise HTTPException(status_code=500, detail="Error interno accediendo al perfil")

    raise HTTPException(status_code=500, detail="Base de datos no disponible")

async def check_permission_programmatic(
    user: UserProfile,
    db: AsyncSession,
    resource: str,
    action: str,
    module: Optional[str] = None
) -> bool:
    """
    Verifica permisos programáticamente dentro de la lógica del endpoint.
    Retorna True/False en lugar de lanzar excepción.
    """
    # 0. Master Key: Super Admin Bypass
    if user.is_super_admin:
        return True

    # 1. Normalization
    resource = resource.lower() if resource else resource
    action = action.lower() if action else action
    if module:
        module = module.lower()
        
    # 2. Role Normalization
    from app.schemas.user_schemas import UserRole
    role_str = UserRole.normalize(user.role)
    
    # 3. Query DB
    from sqlalchemy import func
    filters = [
        RolePermission.role == role_str,
        RolePermission.resource == resource,
        RolePermission.action == action,
        RolePermission.tenant_id == user.tenant_id,
        RolePermission.is_allowed == True
    ]
    
    if module:
        filters.append(RolePermission.module == module)
        
    query = select(RolePermission).where(*filters)
    result = await db.execute(query)
    perm = result.scalar_one_or_none()
    
    return perm is not None

def check_permission(resource: str, action: str, module: Optional[str] = None):
    """
    FastAPI Dependency to check RBAC permissions.
    Usage: Depends(check_permission("users", "create", module="users"))
    """
    async def dependency(
        user: UserProfile = Depends(get_current_user), 
        db: AsyncSession = Depends(get_db)
    ):
        start_time = asyncio.get_event_loop().time()
        
        has_perm = await check_permission_programmatic(user, db, resource, action, module)
        
        if not has_perm:
            # Enhanced Logging
            from app.schemas.user_schemas import UserRole
            role_str = UserRole.normalize(user.role)
            logger.warning(f"⛔ ACCESS DENIED for {user.email} ({role_str}): {module}:{resource}:{action}")
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: {module}:{resource}:{action}"
            )
        
        # Telemetry (Optional - keep it light)
        # duration = asyncio.get_event_loop().time() - start_time
        # if duration > 0.1: logger.warning(f"SLOW PERM CHECK: {duration:.4f}s")
        
        return True
        
    return dependency
