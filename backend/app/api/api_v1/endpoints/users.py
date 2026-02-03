from fastapi import APIRouter, Depends, HTTPException, Query, status
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, or_, func
from sqlalchemy.orm import selectinload
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
from .products import get_skills_manifest
import uuid
from uuid import UUID

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/me", response_model=UserProfileOut)
async def get_my_profile(
    current_user: UserProfile = Depends(get_current_user)
):
    """Retorna el perfil del usuario actual directamente desde la sesión."""
    return current_user

# TEST ENDPOINT - Simple user count
@router.get("/test-count")
async def test_user_count(db: AsyncSession = Depends(get_db)):
    """Simple endpoint to test if we can query users at all"""
    try:
        result = await db.execute(select(UserProfile))
        all_users = result.scalars().all()
        return {
            "total_users": len(all_users),
            "first_3_emails": [u.email for u in all_users[:3]] if all_users else [],
            "message": "Database query successful"
        }
    except Exception as e:
        return {"error": str(e), "total_users": 0}

# RAW SQL TEST - Bypass SQLAlchemy ORM completely
@router.get("/raw-test")
async def raw_sql_test(db: AsyncSession = Depends(get_db)):
    """Test using RAW SQL to bypass SQLAlchemy and isolate if error is in ORM or DB"""
    try:
        logger.info("=== RAW SQL TEST START ===")
        query = text("SELECT id, email, role, tenant_id FROM users_profiles WHERE email = 'jcpenalo@gmail.com'")
        result = await db.execute(query)
        row = result.fetchone()
        
        if row:
            return {
                "success": True,
                "data": {"id": str(row[0]), "email": row[1], "role": row[2], "tenant_id": str(row[3]) if row[3] else None}
            }
        return {"success": False, "error": "User not found"}
    except Exception as e:
        logger.error(f"RAW SQL ERROR: {type(e).__name__}: {str(e)}")
        return {"success": False, "error": str(e), "error_type": type(e).__name__}


@router.get("/", response_model=PaginatedResponse[UserProfileOut])
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=500),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    include_deleted: bool = Query(False),
    include_inactive: bool = Query(True),
    role: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("users", "read", module="config_users"))
):
    """Listado de usuarios vía SQLAlchemy Directo (Aislamiento Multi-tenant)"""
    logger.info(f"🚀 Loading users via SQLAlchemy: page={page}, size={size}, search={search}")
    
    try:
        # 1. Base query con carga ansiosa de organización
        stmt = select(UserProfile).where(UserProfile.tenant_id == current_user.tenant_id).options(selectinload(UserProfile.organization))
        
        # 2. Filtros de jerarquía
        if current_user.role != UserRole.SUPER_ADMIN:
            stmt = stmt.where(UserProfile.role != UserRole.SUPER_ADMIN)

        # 3. Filtros adicionales
        if not include_deleted:
            stmt = stmt.where(UserProfile.is_deleted == False)
        
        if not include_inactive:
            stmt = stmt.where(UserProfile.is_active == True)
            
        if role:
            stmt = stmt.where(UserProfile.role == role)
        
        if search:
            search_clause = or_(
                UserProfile.email.ilike(f"%{search}%"),
                UserProfile.first_name.ilike(f"%{search}%"),
                UserProfile.last_name.ilike(f"%{search}%")
            )
            stmt = stmt.where(search_clause)

        # 4. Conteo total (antes de paginación)
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count_res = await db.execute(count_stmt)
        total_count = total_count_res.scalar() or 0

        # 5. Orden y Paginación
        stmt = stmt.order_by(UserProfile.last_seen_at.desc().nulls_last())
        stmt = stmt.offset((page - 1) * size).limit(size)

        # 6. Ejecutar
        result = await db.execute(stmt)
        users = result.scalars().all()

        # Enriquecer para el schema (UserProfileOut espera organization_name)
        for u in users:
            if u.organization:
                setattr(u, 'organization_name', u.organization.name)

        return PaginatedResponse(
            total=total_count,
            page=page,
            size=size,
            items=users
        )
    except Exception as e:
        logger.error(f"Error fetching users via SQLAlchemy: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Error al recuperar lista de usuarios. ||| TECH_DETAILS: {str(e)}"
        )

@router.post("/", response_model=UserProfileOut)
async def create_user(
    user_in: UserIdentityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("users", "create", module="config_users"))
):
    # 1. Obtener niveles
    creator_level = get_role_level(current_user.role)
    new_user_role_level = get_role_level(user_in.role)

    # 2. Regla de Oro: Solo Super Admin puede violar jerarquías.
    # El resto NO puede crear a alguien de nivel igual o superior.
    
    # NUEVA REGLA DE SEGURIDAD (User Request):
    # Un Admin (o inferior) NUNCA puede crear un Super Admin.
    if user_in.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=403, 
            detail="Acción denegada: Tu nivel de privilegios no permite crear usuarios con el rol 'Super Admin'."
        )

    # NUEVA REGLA DE SEGURIDAD (Multi-tenant):
    # Forzar el tenant_id del creador para evitar inyección de usuarios en otras orgs.
    if current_user.role != UserRole.SUPER_ADMIN:
        user_in.tenant_id = current_user.tenant_id
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
                detail="Este correo electrónico ya está registrado en el sistema. Si el usuario fue eliminado, puede reactivarlo desde la Gestión de Usuarios."
            )
            
        raise HTTPException(
            status_code=500, 
            detail=f"Hubo un problema interno al crear el perfil de usuario. Por favor, contacte a soporte. ||| TECH_DETAILS: {str(e)}"
        )

@router.patch("/{user_id}", response_model=UserProfileOut)
async def update_user(
    user_id: UUID,
    user_in: UserProfileBase, # Partial updates
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("users", "update", module="config_users"))
):
    """Actualización de usuario vía SQLAlchemy (Aislamiento Estricto)"""
    # 1. Localizar usuario
    stmt = select(UserProfile).where(UserProfile.id == user_id)
    if current_user.role != UserRole.SUPER_ADMIN:
        stmt = stmt.where(UserProfile.tenant_id == current_user.tenant_id)
    
    res = await db.execute(stmt)
    db_user = res.scalar_one_or_none()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado en su organización.")

    # --- VALIDACIÓN DE JERARQUÍA ---
    creator_level = get_role_level(current_user.role)
    target_user_level = get_role_level(db_user.role)

    if current_user.role != UserRole.SUPER_ADMIN:
        if target_user_level >= creator_level:
             raise HTTPException(status_code=403, detail="Jerarquía insuficiente para editar este perfil.")

        if user_in.role and get_role_level(user_in.role) >= creator_level:
            raise HTTPException(status_code=403, detail="No puedes asignar un rol igual o superior al tuyo.")

    # --- ACTUALIZACIÓN ---
    update_data = user_in.model_dump(exclude_unset=True)
    
    # Validación de Skills (Blindaje)
    if "product_skills" in update_data:
        valid_skills = await get_skills_manifest(current_user=current_user)
        valid_values = {s["value"] for s in valid_skills}
        unauthorized = [s for s in update_data["product_skills"] if s not in valid_values]
        if unauthorized:
            raise HTTPException(status_code=403, detail=f"Skills no autorizadas: {unauthorized}")

    for field, value in update_data.items():
        setattr(db_user, field, value)

    try:
        await db.commit()
        await db.refresh(db_user)
        
        # Sincronizar Metadata en Auth (Opcional pero recomendado para consistencia en JWT)
        if user_in.first_name or user_in.last_name or user_in.role:
            meta = {}
            if user_in.first_name or user_in.last_name:
                meta["full_name"] = f"{db_user.first_name} {db_user.last_name}"
            if user_in.role:
                meta["role"] = db_user.role
            try:
                supabase_admin.auth.admin.update_user_by_id(str(user_id), {"user_metadata": meta})
            except: pass

        return db_user
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar: {str(e)}")

@router.put("/{user_id}", response_model=UserProfileOut)
async def update_user_put(
    user_id: UUID,
    user_in: UserProfileBase,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("users", "update", module="config_users"))
):
    """Alias PUT para actualización completa o parcial (Legacy Support)"""
    return await update_user(user_id, user_in, db, current_user)

@router.post("/{user_id}/reactivate", response_model=UserProfileOut)
async def reactivate_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("users", "update", module="config_users"))
):
    """Reactivación de usuario vía SQLAlchemy"""
    stmt = select(UserProfile).where(UserProfile.id == user_id)
    if current_user.role != UserRole.SUPER_ADMIN:
        stmt = stmt.where(UserProfile.tenant_id == current_user.tenant_id)
    
    res = await db.execute(stmt)
    db_user = res.scalar_one_or_none()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    db_user.is_deleted = False
    db_user.is_active = True
    
    try:
        await db.commit()
        await db.refresh(db_user)
        return db_user
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error en reactivación: {str(e)}")

@router.patch("/{user_id}/password")
async def update_password(
    user_id: UUID,
    pwd_in: UserPasswordUpdate,
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("users", "update", module="config_users"))
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
@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("users", "delete", module="config_users"))
):
    """
    Soft-delete de usuario. Requiere permiso explícito en la matriz.
    """
    # 1. Localizar usuario
    stmt = select(UserProfile).where(UserProfile.id == user_id)
    if current_user.role != UserRole.SUPER_ADMIN:
        stmt = stmt.where(UserProfile.tenant_id == current_user.tenant_id)
    
    res = await db.execute(stmt)
    db_user = res.scalar_one_or_none()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    # 2. Validación de Jerarquía
    creator_level = get_role_level(current_user.role)
    target_user_level = get_role_level(db_user.role)

    if current_user.role != UserRole.SUPER_ADMIN:
        if target_user_level >= creator_level:
             raise HTTPException(status_code=403, detail="Jerarquía insuficiente para eliminar este usuario.")

    # 3. Soft Delete
    db_user.is_deleted = True
    db_user.is_active = False # Desactivar acceso inmediatamente
    
    try:
        await db.commit()
        return None
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar usuario: {str(e)}")

@router.delete("/{user_id}/purge", status_code=status.HTTP_204_NO_CONTENT)
async def purge_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("users", "purge", module="config_users"))
):
    """
    PURGA DE USUARIO (Borrado Físico Irreversible).
    Requiere permiso explícito 'purge' en la matriz.
    """
    # 1. Localizar usuario
    stmt = select(UserProfile).where(UserProfile.id == user_id)
    if current_user.role != UserRole.SUPER_ADMIN:
        stmt = stmt.where(UserProfile.tenant_id == current_user.tenant_id)
    
    res = await db.execute(stmt)
    db_user = res.scalar_one_or_none()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    # 2. Validación de Jerarquía (Incluso para purga)
    creator_level = get_role_level(current_user.role)
    target_user_level = get_role_level(db_user.role)

    if current_user.role != UserRole.SUPER_ADMIN:
        if target_user_level >= creator_level:
             raise HTTPException(status_code=403, detail="Jerarquía insuficiente para purgar este usuario.")

    # 3. Borrado Físico DB Local
    try:
        # Primero intentamos borrar de Auth (Supabase)
        try:
             supabase_admin.auth.admin.delete_user(str(user_id))
        except Exception as e:
             logger.error(f"Error deleting user from Supabase Auth: {e}")
             
        await db.delete(db_user)
        await db.commit()
        return None
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error crítico al purgar usuario: {str(e)}")
