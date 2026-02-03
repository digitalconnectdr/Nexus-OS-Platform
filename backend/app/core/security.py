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
    return ROLE_HIERARCHY.get(role_name, 0)

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
                if (db_user.role == UserRole.SUPER_ADMIN or str(db_user.role) == "Super Admin") and x_tenant_id:
                    try:
                        clean_tenant_id = x_tenant_id.strip('"').strip("'")
                        uuid_obj = uuid.UUID(clean_tenant_id)
                        current_tenant_id = str(uuid_obj)
                        # Temporarily override in-memory for this request context
                        db_user.tenant_id = uuid_obj
                        print(f"🔄 CONTEXT OVERRIDE SUCCESS: {db_user.email} -> {current_tenant_id}")
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

def check_permission(resource: str, action: str, module: Optional[str] = None):
    """
    FastAPI Dependency to check RBAC permissions.
    Usage: Depends(check_permission("users", "write", module="config"))
    """
    async def dependency(
        user: UserProfile = Depends(get_current_user), 
        db: AsyncSession = Depends(get_db)
    ):
        import logging
        logger = logging.getLogger(__name__)
        
        log_msg = f"🔐 Checking permission: {module or '*'}:{resource}:{action} for user {user.email}"
        logger.info(log_msg)
        
        # 1. Bypass Supremo
        if user.role == UserRole.SUPER_ADMIN:
            return True
            
        from sqlalchemy import func
        
        # 2. Granular Verification in Matrix
        target_role = user.role
        if hasattr(target_role, "value"):
            role_str = target_role.value
        else:
            role_str = str(target_role)
            
        # Clean up any potential "UserRole.NAME" stringification
        if "." in role_str and not any(r in role_str for r in ["Representante", "Digitación", "Seguimiento"]): 
            role_str = role_str.split(".")[-1]
            
        filters = [
            RolePermission.role == role_str,
            func.lower(RolePermission.resource) == resource.lower(),
            func.lower(RolePermission.action) == action.lower(),
            RolePermission.tenant_id == user.tenant_id
        ]
        if module:
            filters.append(func.lower(RolePermission.module) == module.lower())
            
        query = select(RolePermission).where(*filters)
        
        result = await db.execute(query)
        perm = result.scalar_one_or_none()
        
        if not perm or not perm.is_allowed:
            logger.error(f"❌ Permission DENIED for {user.email}: {resource}:{action} (Module: {module}). Filters: Role={role_str}, Tenant={user.tenant_id}")
            if perm:
                logger.error(f"   Record found but is_allowed={perm.is_allowed}")
            else:
                logger.error(f"   No record found in role_permissions matrix for filters above.")
            
            # Spanish Translation Mapping
            labels = {
                "sales": "Ventas", "products": "Productos", "finance": "Finanzas",
                "users": "Usuarios", "campaigns": "Campañas", "goals": "Metas",
                "organizations": "Organización",
                "read": "Ver", "create": "Crear", "update": "Editar", "delete": "Borrar",
                "write": "Escribir", "export": "Exportar", "read_own": "Ver Propio",
                "read_global": "Ver Global", "read_summary": "Ver Resumen",
                "configure": "Configurar"
            }
            
            res_label = labels.get(resource, resource.capitalize())
            act_label = labels.get(action, action.capitalize())
            
            error_msg = f"⛔ Acceso Denegado: No tienes permisos suficientes para '{act_label} {res_label}'."
            
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )
        
        logger.info(f"✅ Permission granted via matrix for {user.email}")
        return True
        
    return dependency
