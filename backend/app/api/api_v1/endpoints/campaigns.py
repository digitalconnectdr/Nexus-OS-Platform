from fastapi import APIRouter, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
import logging
from app.core.supabase import supabase_admin
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional, Any
from app.api.deps import get_db
from app.core.security import check_permission, get_current_user
from app.models.core import Campaign, UserProfile
from app.schemas.core import CampaignOut, CampaignUpdate, CampaignCreate
from uuid import UUID

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[CampaignOut])
async def list_campaigns(
    skip: int = 0,
    limit: int = 100,
    size: int = None,
    include_inactive: bool = False,
    trashed: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("campaigns", "read", module="config_campaigns"))
):
    """Listado de campañas vía SQLAlchemy con relaciones"""
    try:
        page_size = size if size is not None else limit
        stmt = select(Campaign).options(selectinload(Campaign.default_status)).where(Campaign.tenant_id == current_user.tenant_id)
        
        if trashed:
            # Show ONLY deleted items
            stmt = stmt.where(Campaign.is_deleted == True)
        else:
            # Show ONLY non-deleted items (default behavior)
            stmt = stmt.where(Campaign.is_deleted == False)
            if not include_inactive:
                stmt = stmt.where(Campaign.is_active == True)
        
        # Pagination
        stmt = stmt.offset(skip).limit(page_size)
        
        result = await db.execute(stmt)
        return result.scalars().all()
    except Exception as e:
        logger.error(f"Error listing campaigns via SQLAlchemy: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=CampaignOut)
async def create_campaign(
    campaign_in: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("campaigns", "create", module="config_campaigns"))
):
    """Alta de campaña vía SQL"""
    try:
        campaign_data = campaign_in.model_dump()
        campaign_data["tenant_id"] = current_user.tenant_id
        
        db_campaign = Campaign(**campaign_data)
        db.add(db_campaign)
        await db.commit()
        await db.refresh(db_campaign)
        
        # Recargar con relaciones
        stmt = select(Campaign).options(selectinload(Campaign.default_status)).where(Campaign.id == db_campaign.id)
        res = await db.execute(stmt)
        return res.scalar_one()
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating campaign via SQL: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{campaign_id}", response_model=CampaignOut)
async def update_campaign(
    campaign_id: UUID,
    campaign_in: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("campaigns", "update", module="config_campaigns"))
):
    """Actualización de campaña vía SQL"""
    try:
        stmt = select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == current_user.tenant_id)
        result = await db.execute(stmt)
        db_campaign = result.scalar_one_or_none()
        
        if not db_campaign:
            raise HTTPException(status_code=404, detail="Campaña no encontrada")

        update_data = campaign_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_campaign, key, value)
            
        await db.commit()
        
        # Retornar enriquecido
        stmt_e = select(Campaign).options(selectinload(Campaign.default_status)).where(Campaign.id == campaign_id)
        res_e = await db.execute(stmt_e)
        return res_e.scalar_one()
    except HTTPException: raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating campaign via SQL: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("campaigns", "delete", module="config_campaigns"))
):
    """Baja lógica vía SQL"""
    try:
        stmt = select(Campaign).where(Campaign.id == campaign_id, Campaign.tenant_id == current_user.tenant_id)
        result = await db.execute(stmt)
        db_campaign = result.scalar_one_or_none()
        
        if not db_campaign:
            raise HTTPException(status_code=404, detail="Campaña no encontrada")
            
        db_campaign.is_deleted = True
        db_campaign.is_active = False # Deactivate as well
        await db.commit()
        return {"status": "success", "message": "Campaign soft-deleted"}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting campaign via SQL: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{campaign_id}/purge", status_code=204)
async def purge_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("campaigns", "purge", module="config_campaigns"))
):
    """PURGA DE CAMPAÑA: Borrado físico irreversible."""
    try:
        from sqlalchemy import delete
        
        # Hard Delete directo via SQL para evitar filtros de Soft Delete del ORM
        stmt = delete(Campaign).where(
            Campaign.id == campaign_id, 
            Campaign.tenant_id == current_user.tenant_id
        )
        
        logger.info(f"PURGING CAMPAIGN {campaign_id} - SQL: {stmt}")
        
        result = await db.execute(stmt)
        
        # Explicit Flush
        await db.flush()
        await db.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Campaña no encontrada o ya eliminada.")
            
        return None
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error purging campaign via SQL: {e}")
        # Manejo de error FK explícito si hay hijos
        if "foreign key constraint" in str(e).lower():
             raise HTTPException(status_code=409, detail="No se puede purgar la campaña porque tiene dependencias (productos/ventas). Elimine primero los registros dependientes.")
        raise HTTPException(status_code=500, detail=str(e))
