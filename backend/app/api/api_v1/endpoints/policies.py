from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID
from app.api.deps import get_db
from app.core.security import get_current_user
from app.models.core import RolePolicy, UserProfile
from app.schemas.core import RolePolicyOut, RolePolicyCreate, RolePolicyUpdate
from app.services.workload_service import check_user_availability

router = APIRouter()

@router.get("/", response_model=List[RolePolicyOut])
async def list_role_policies(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    """Lista las políticas de ruteo por rol."""
    result = await db.execute(select(RolePolicy))
    return result.scalars().all()

@router.get("/{role}", response_model=RolePolicyOut)
async def get_role_policy(
    role: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    """Obtiene la política de un rol específico."""
    result = await db.execute(select(RolePolicy).where(RolePolicy.role == role))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Política no encontrada para este rol")
    return policy

@router.post("/", response_model=RolePolicyOut)
async def create_or_update_policy(
    policy_in: RolePolicyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    """Crea o actualiza una política de rol."""
    result = await db.execute(select(RolePolicy).where(RolePolicy.role == policy_in.role))
    existing = result.scalar_one_or_none()
    
    if existing:
        for key, value in policy_in.model_dump(exclude_unset=True).items():
            setattr(existing, key, value)
        policy = existing
    else:
        policy = RolePolicy(**policy_in.model_dump())
        db.add(policy)
        
    await db.commit()
    await db.refresh(policy)
    return policy

@router.patch("/{role}", response_model=RolePolicyOut)
async def update_role_policy(
    role: str,
    policy_in: RolePolicyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    """Actualiza parcialmente una política."""
    result = await db.execute(select(RolePolicy).where(RolePolicy.role == role))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Política no encontrada")
    
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
    db: AsyncSession = Depends(get_db)
):
    """Endpoint para que el frontend verifique disponibilidad de un usuario."""
    return await check_user_availability(db, user_id, product)
