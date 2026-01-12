from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.api.deps import get_db
from app.models.core import UserProfile, RolePermission
from app.schemas.core import UserRole
from app.core.config import settings
from supabase import create_client, Client
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import uuid

security = HTTPBearer()
supabase_client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

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

# Mocked get_current_user for integration with RBAC
# In a real system, this would decode a JWT and fetch the user from DB
async def get_current_user(
    db: AsyncSession = Depends(get_db),
    auth: HTTPAuthorizationCredentials = Depends(security)
) -> UserProfile:
    """ Validates the Supabase JWT and returns the DB UserProfile. """
    try:
        token = auth.credentials
        # Supabase get_user verifies the JWT on the server side
        # Note: In production, consider locally decoding the JWT to reduce latency
        res = supabase_client.auth.get_user(token)
        
        if not res or not res.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión inválida")
            
        supabase_id = res.user.id
        print(f"DEBUG AUTH: Supabase ID from Token: {supabase_id}")
        
        # Fetch from local DB with Eager Loading for all journey data
        result = await db.execute(
            select(UserProfile)
            .options(
                selectinload(UserProfile.organization),
                selectinload(UserProfile.permissions)
            )
            .where(UserProfile.id == uuid.UUID(supabase_id))
        )
        user = result.scalar_one_or_none()
        
        if not user:
            print(f"DEBUG AUTH: User not found in local DB for ID {supabase_id}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Usuario no registrado en DB local (ID: {supabase_id})."
            )
        
        if not user.is_active:
            print(f"DEBUG AUTH: User {user.email} is inactive")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario inactivo en el sistema central."
            )
            
        return user
        
    except Exception as e:
        print(f"Auth Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Error de autenticación: {str(e)}"
        )

def check_permission(resource: str, action: str):
    """
    FastAPI Dependency to check RBAC permissions.
    Usage: Depends(check_permission("users", "write"))
    """
    async def dependency(
        user: UserProfile = Depends(get_current_user), 
        db: AsyncSession = Depends(get_db)
    ):
        # 1. Bypass Supremo (Super Admin have all power)
        if user.role == UserRole.SUPER_ADMIN:
            return True
            
        # 2. Granular Verification in Matrix
        query = select(RolePermission).where(
            RolePermission.role == user.role,
            RolePermission.resource == resource,
            RolePermission.action == action
        )
        
        result = await db.execute(query)
        perm = result.scalar_one_or_none()
        
        if not perm or not perm.is_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"No tienes permiso para realizar esta acción ({resource}:{action})"
            )
        
        return True
        
    return dependency
