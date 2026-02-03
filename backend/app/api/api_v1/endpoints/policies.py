from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
from app.api.deps import get_db
from app.core.security import get_current_user, check_permission
from app.models.core import RolePolicy, UserProfile
from app.schemas.core import RolePolicyOut, RolePolicyCreate, RolePolicyUpdate
from app.services.workload_service import check_user_availability
import logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=List[RolePolicyOut])
async def list_role_policies(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("policies", "read", module="policies"))
):
    """Lista las políticas de ruteo por rol de la organización."""
    result = await db.execute(
        select(RolePolicy).where(RolePolicy.tenant_id == current_user.tenant_id)
    )
    return result.scalars().all()

@router.get("/{role}", response_model=RolePolicyOut)
async def get_role_policy(
    role: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("policies", "read", module="policies"))
):
    """Obtiene la política de un rol específico dentro de la organización."""
    result = await db.execute(
        select(RolePolicy).where(
            RolePolicy.role == role,
            RolePolicy.tenant_id == current_user.tenant_id
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Política no encontrada para este rol en tu organización")
    return policy

@router.post("/", response_model=RolePolicyOut)
async def create_or_update_policy(
    policy_in: RolePolicyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("policies", "update", module="policies"))
):
    """Crea o actualiza una política de rol para la organización actual."""
    # Forzar el tenant_id del usuario actual por seguridad
    target_tenant_id = current_user.tenant_id
    
    result = await db.execute(
        select(RolePolicy).where(
            RolePolicy.role == policy_in.role,
            RolePolicy.tenant_id == target_tenant_id
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        update_data = policy_in.model_dump(exclude_unset=True)
        update_data['tenant_id'] = target_tenant_id # Asegurar consistencia
        for key, value in update_data.items():
            setattr(existing, key, value)
        policy = existing
    else:
        policy_data = policy_in.model_dump()
        policy_data['tenant_id'] = target_tenant_id # Asegurar consistencia
        policy = RolePolicy(**policy_data)
        db.add(policy)
        
    await db.commit()
    await db.refresh(policy)
    return policy

@router.patch("/{role}", response_model=RolePolicyOut)
async def update_role_policy(
    role: str,
    policy_in: RolePolicyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("policies", "update", module="policies"))
):
    """Actualiza parcialmente una política de la organización."""
    result = await db.execute(
        select(RolePolicy).where(
            RolePolicy.role == role,
            RolePolicy.tenant_id == current_user.tenant_id
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Política no encontrada en esta organización")
    
    update_data = policy_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(policy, key, value)
        
    await db.commit()
    await db.refresh(policy)
    return policy

@router.get("/check/{user_id}")
async def check_availability(
    user_id: UUID,
    product: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("policies", "read", module="policies"))
):
    """Endpoint para que el frontend verifique disponibilidad de un usuario."""
    try:
        return await check_user_availability(db, user_id, product)
    except Exception as e:
        logger.error(f"POLICIES CHECK ERROR: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Error al verificar disponibilidad del usuario. ||| TECH_DETAILS: {str(e)}"
        )
