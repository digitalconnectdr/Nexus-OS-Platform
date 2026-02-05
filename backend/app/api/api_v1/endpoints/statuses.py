from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.api.deps import get_db
from app.models.status import Status
from app.schemas.core import StatusOut, StatusCreate
from app.core.supabase import supabase_admin
from app.core.security import get_current_user, check_permission
from app.models.core import UserProfile
from uuid import UUID

import logging
router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=List[StatusOut])
async def list_statuses(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("statuses", "view_tab", module="config"))
):
    """Listado de estados vía SQL Directo"""
    stmt = select(Status).where(Status.tenant_id == current_user.tenant_id)
    if not include_inactive:
        stmt = stmt.where(Status.is_active == True)
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/", response_model=StatusOut)
async def create_status(
    status_in: StatusCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("statuses", "view_tab", module="config"))
):
    # Enforce tenant_id from current_user
    status_data = status_in.model_dump()
    status_data["tenant_id"] = current_user.tenant_id
    
    if status_in.is_default:
        from sqlalchemy import update
        await db.execute(
            update(Status)
            .where(Status.tenant_id == current_user.tenant_id)
            .values(is_default=False)
        )

    status = Status(**status_data)
    db.add(status)
    await db.commit()
    await db.refresh(status)
    return status

@router.put("/{status_id}", response_model=StatusOut)
async def update_status(
    status_id: UUID,
    status_in: StatusCreate, # Reuse create schema for simplicity
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("statuses", "view_tab", module="config"))
):
    result = await db.execute(
        select(Status)
        .where(Status.id == status_id, Status.tenant_id == current_user.tenant_id)
    )
    status = result.scalar_one_or_none()
    if not status:
        raise HTTPException(status_code=404, detail="Status not found")
    
    if status_in.is_default:
        from sqlalchemy import update
        await db.execute(
            update(Status)
            .where(Status.tenant_id == status.tenant_id)
            .where(Status.id != status_id)
            .values(is_default=False)
        )

    for key, value in status_in.model_dump().items():
        setattr(status, key, value)
    
    await db.commit()
    await db.refresh(status)
    return status

@router.post("/bulk", response_model=List[StatusOut])
async def bulk_save_statuses(
    statuses_in: List[dict],
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("statuses", "view_tab", module="config"))
):
    try:
        # Enforce tenant_id from current_user
        tenant_id = current_user.tenant_id

        # Check if any status in the bulk request is set as default
        has_new_default = any(item.get("is_default") for item in statuses_in)
        
        if has_new_default:
            # We need to find which one is the new default to preserve it, 
            # while unsetting every status CURRENTLY in the DB for this tenant.
            from sqlalchemy import update
            await db.execute(
                update(Status)
                .where(Status.tenant_id == UUID(str(tenant_id)))
                .values(is_default=False)
            )

        results = []
        for item in statuses_in:
            sid = item.get("id")
            if sid:
                # Update
                query = select(Status).where(Status.id == sid, Status.tenant_id == tenant_id)
                result = await db.execute(query)
                status = result.scalar_one_or_none()
                if status:
                    for key, value in item.items():
                        if hasattr(status, key) and key != "id":
                            if key == "tenant_id": continue # Prevent tenant manipulation
                            setattr(status, key, value)
                    results.append(status)
            else:
                # Create
                item["tenant_id"] = tenant_id # Enforce tenant
                status = Status(**item)
                db.add(status)
                results.append(status)
        
        await db.commit()
        # Refresh all
        for r in results:
            await db.refresh(r)
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"BULK STATUS ERROR: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Hubo un problema al procesar la actualización masiva de estados. Por favor, contacte a soporte. ||| TECH_DETAILS: {str(e)}"
        )
@router.delete("/{status_id}")
async def delete_status(
    status_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("statuses", "view_tab", module="config"))
):
    result = await db.execute(
        select(Status)
        .where(Status.id == status_id, Status.tenant_id == current_user.tenant_id)
    )
    status = result.scalar_one_or_none()
    if not status:
        raise HTTPException(status_code=404, detail="Status not found")
    
    # Soft delete
    status.is_active = False
    await db.commit()
    return {"detail": "Status deactivated"}
