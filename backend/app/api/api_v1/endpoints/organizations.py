from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db
from app.models.core import Organization
from app.schemas.core import OrganizationOut

router = APIRouter()

from app.core.security import get_current_user
from app.models.core import UserProfile

@router.get("/me", response_model=OrganizationOut)
async def get_my_organization(
    current_user: UserProfile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Organization).where(Organization.id == current_user.tenant_id))
    org = result.scalar_one_or_none()
    
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")
    
    return org
