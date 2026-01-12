from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional, Any
from app.api.deps import get_db
from app.core.security import check_permission
from app.models.core import Campaign
from app.schemas.core import CampaignOut, CampaignUpdate, CampaignCreate
from uuid import UUID

router = APIRouter()

@router.get("/", response_model=List[CampaignOut])
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    size: int = None,  # Alias for limit (backward compatibility)
    include_inactive: bool = False,
    _: bool = Depends(check_permission("campaigns", "read"))
):
    """
    List campaigns with pagination and optional filtering for inactive records.
    Defaults to active records only.
    """
    try:
        # Use 'size' if provided, otherwise use 'limit'
        page_size = size if size is not None else limit
        query = select(Campaign).options(selectinload(Campaign.default_status)).offset(skip).limit(page_size)
        if not include_inactive:
            query = query.where(Campaign.is_active == True)
        
        result = await db.execute(query)
        campaigns = result.scalars().all()
        return campaigns
    except Exception as e:
        print(f"Error listing campaigns: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=CampaignOut)
async def create_campaign(
    campaign_in: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(check_permission("campaigns", "write"))
):
    campaign = Campaign(**campaign_in.model_dump())
    db.add(campaign)
    await db.commit()
    
    # Re-fetch with eager loading for the response
    query = select(Campaign).options(selectinload(Campaign.default_status)).where(Campaign.id == campaign.id)
    result = await db.execute(query)
    return result.scalar_one()

@router.put("/{campaign_id}", response_model=CampaignOut)
async def update_campaign(
    campaign_id: UUID,
    campaign_in: CampaignUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    update_data = campaign_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(campaign, key, value)
    
    await db.commit()
    
    # Re-fetch with eager loading for the response
    query = select(Campaign).options(selectinload(Campaign.default_status)).where(Campaign.id == campaign_id)
    result = await db.execute(query)
    return result.scalar_one()
@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(check_permission("campaigns", "delete"))
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Soft delete (Logical Deletion)
    campaign.is_active = False
    await db.commit()
    return {"status": "success", "message": "Campaign deactivated"}
