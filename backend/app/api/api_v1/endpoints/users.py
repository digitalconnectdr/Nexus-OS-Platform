from fastapi import APIRouter, Depends, HTTPException, Query
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.api.deps import get_db
from app.models.core import UserProfile, RolePermission
from app.core.supabase import supabase_admin
from app.core.security import check_permission, get_current_user, get_role_level
from app.api.pagination import CommonQueryParams, apply_pagination_logic
from app.schemas.core import (
    UserProfileOut, UserProfileBase, UserIdentityCreate, 
    UserRole, UserPasswordUpdate, PaginatedResponse
)
import uuid
from uuid import UUID

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/me", response_model=UserProfileOut)
async def get_my_profile(
    current_user: UserProfile = Depends(get_current_user)
):
    return current_user

@router.get("/", response_model=PaginatedResponse[UserProfileOut])
async def list_users(
    params: CommonQueryParams = Depends(),
    role: Optional[str] = Query(None),
    include_deleted: bool = Query(False, description="Incluir usuarios marcados como eliminados"),
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(check_permission("users", "read"))
):
    # Base query for UserProfile
    query = select(UserProfile)
    
    if not include_deleted:
        query = query.where(UserProfile.is_deleted == False)
    
    if not include_inactive:
        query = query.where(UserProfile.is_active == True)
        
    if role:
        query = query.where(UserProfile.role == role)
    
    # Define fields for search filter
    search_fields = ["email", "first_name", "last_name"]
    
    # Use the utility to apply pagination, search and sort
    pagination_result = await apply_pagination_logic(
        db=db,
        model=UserProfile,
        params=params,
        base_query=query,
        search_fields=search_fields
    )
    
    return pagination_result

@router.post("/", response_model=UserProfileOut)
async def create_user(
    user_in: UserIdentityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("users", "write"))
):
    # 1. Obtener niveles
    creator_level = get_role_level(current_user.role)
    new_user_role_level = get_role_level(user_in.role)

    # 2. Regla de Oro: Solo Super Admin puede violar jerarquías.
    # El resto NO puede crear a alguien de nivel igual o superior.
    if current_user.role != UserRole.SUPER_ADMIN:
        if new_user_role_level >= creator_level:
            raise HTTPException(
                status_code=403, 
                detail="Acceso Denegado: Tu nivel de autoridad no permite crear usuarios con el rol de 'Super Admin' o superior al tuyo."
            )
    try:
        # 1. Crear identidad en Supabase Auth (Nube)
        # Usamos el Admin API para evitar validaciones de email si se prefiere
        logger.info(f"Creating Supabase Auth user: {user_in.email}")
        auth_res = supabase_admin.auth.admin.create_user({
            "email": user_in.email,
            "password": user_in.password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": f"{user_in.first_name or ''} {user_in.last_name or ''}".strip(),
                "role": user_in.role
            }
        })
        
        if not auth_res or not auth_res.user:
            raise Exception("No se pudo obtener el usuario creado desde Supabase")
            
        new_user_id = auth_res.user.id
        logger.info(f"Supabase user created with UID: {new_user_id}")

        # 2. Crear el perfil en la Base de Datos Local
        db_user = UserProfile(
            id=uuid.UUID(new_user_id), # Vinculación exacta con Supabase
            tenant_id=user_in.tenant_id,
            email=user_in.email,
            first_name=user_in.first_name,
            last_name=user_in.last_name,
            role=user_in.role,
            is_active=True
        )
        
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)
        logger.info(f"Successfully created local user profile for ID: {db_user.id}")
        return db_user
    except Exception as e:
        error_str = str(e)
        logger.error(f"Error creating user profile: {error_str}", exc_info=True)
        await db.rollback()
        
        # Manejo amigable de errores de Supabase
        if "already been registered" in error_str:
            raise HTTPException(
                status_code=400,
                detail="Este correo electrónico ya está registrado en el sistema. Si el usuario fue eliminado, puedes reactivarlo desde la Gestión de Usuarios."
            )
            
        raise HTTPException(
            status_code=500, 
            detail=f"Error interno al crear perfil: {error_str}"
        )

@router.patch("/{user_id}", response_model=UserProfileOut)
async def update_user(
    user_id: UUID,
    user_in: UserProfileBase, # Partial updates
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("users", "write"))
):
    result = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # --- VALIDACIÓN DE JERARQUÍA ---
    creator_level = get_role_level(current_user.role)
    target_user_level = get_role_level(user.role)

    # REGLA A: Protección de Destino (No puedo tocar a mis superiores)
    if current_user.role != UserRole.SUPER_ADMIN:
        if target_user_level >= creator_level:
             raise HTTPException(
                 status_code=403, 
                 detail="No puedes editar este perfil: El usuario tiene un rango igual o superior al tuyo."
             )

    # REGLA B: Protección de Ascenso (No puedo ascender a nadie por encima de mí)
    if user_in.role is not None:
        new_role_level = get_role_level(user_in.role)
        if current_user.role != UserRole.SUPER_ADMIN:
            if new_role_level >= creator_level:
                raise HTTPException(
                    status_code=403, 
                    detail="Operación rechazada: No tienes permisos para ascender a un usuario a un nivel igual o superior al tuyo."
                )
    # ------------------------------

    # --- VALIDACIÓN CRÍTICA: CAMBIO DE ROL (Permiso Granular) ---
    if user_in.role is not None and user_in.role != user.role:
        # El usuario está intentando cambiar el rol. ¿Tiene permiso 'change_role'?
        has_permission = False
        if current_user.role == UserRole.SUPER_ADMIN:
            has_permission = True
        else:
            perm_query = select(RolePermission).where(
                RolePermission.role == current_user.role,
                RolePermission.resource == "users",
                RolePermission.action == "change_role",
                RolePermission.is_allowed == True
            )
            result = await db.execute(perm_query)
            if result.scalar_one_or_none():
                has_permission = True
        
        if not has_permission:
            raise HTTPException(
                status_code=403, 
                detail="No tienes autorización para cambiar el Rol de un usuario."
            )
    # ---------------------------------------------

    update_data = user_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    
    await db.commit()
    await db.refresh(user)
    return user
@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    permanent: bool = Query(False, description="Eliminar permanentemente de la DB y Supabase"),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(check_permission("users", "delete"))
):
    result = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Si ya estaba marcado como eliminado y se vuelve a borrar, o si se pide permanente
    if user.is_deleted or permanent:
        try:
            # 1. Eliminar de Supabase Auth
            supabase_admin.auth.admin.delete_user(str(user_id))
            # 2. Eliminar de DB local (Hard Delete)
            await db.delete(user)
            await db.commit()
            return {"status": "success", "message": "Usuario eliminado permanentemente"}
        except Exception as e:
            logger.error(f"Error in permanent deletion: {e}")
            # Fallback to local delete if Supabase fails (e.g. user already gone there)
            await db.delete(user)
            await db.commit()
            return {"status": "success", "message": "Usuario eliminado localmente"}

    # Soft Delete (por defecto)
    user.is_deleted = True
    user.is_active = False # Desactivar también por seguridad
    await db.commit()
    return {"status": "success", "message": "Usuario movido a la lista de eliminados"}

@router.post("/{user_id}/reactivate", response_model=UserProfileOut)
async def reactivate_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(check_permission("users", "write"))
):
    result = await db.execute(select(UserProfile).where(UserProfile.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_deleted = False
    user.is_active = True
    await db.commit()
    await db.refresh(user)
    return user

@router.patch("/{user_id}/password")
async def update_password(
    user_id: UUID,
    pwd_in: UserPasswordUpdate,
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("users", "write"))
):
    if pwd_in.password != pwd_in.confirm_password:
        raise HTTPException(status_code=400, detail="Las contraseñas no coinciden")
    
    if len(pwd_in.password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")

    try:
        # Use Supabase Admin API to update password
        res = supabase_admin.auth.admin.update_user_by_id(
            str(user_id),
            {"password": pwd_in.password}
        )
        
        # In supabase-py v2, update_user_by_id might return the user or raise an exception
        # Let's handle it gracefully
        return {"status": "success", "message": "Contraseña actualizada correctamente"}
    except Exception as e:
        logger.error(f"Error resetting password for user {user_id}: {str(e)}")
        # Check if error message from supabase contains useful info
        detail = str(e)
        if "Password should be" in detail:
            detail = "La contraseña no cumple con los requisitos de seguridad de Supabase."
        raise HTTPException(status_code=400, detail=detail)
