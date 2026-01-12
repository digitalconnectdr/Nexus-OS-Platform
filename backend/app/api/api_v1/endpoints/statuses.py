from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.api.deps import get_db
from app.models.status import Status
from app.schemas.core import StatusOut, StatusCreate
from uuid import UUID

router = APIRouter()

@router.get("/", response_model=List[StatusOut])
async def list_statuses(
    db: AsyncSession = Depends(get_db),
    include_inactive: bool = False
):
    query = select(Status)
    if not include_inactive:
        query = query.where(Status.is_active == True)
    
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=StatusOut)
async def create_status(
    status_in: StatusCreate,
    db: AsyncSession = Depends(get_db)
):
    if status_in.is_default:
        from sqlalchemy import update
        await db.execute(
            update(Status)
            .where(Status.tenant_id == status_in.tenant_id)
            .values(is_default=False)
        )

    status = Status(**status_in.model_dump())
    db.add(status)
    await db.commit()
    await db.refresh(status)
    return status

@router.put("/{status_id}", response_model=StatusOut)
async def update_status(
    status_id: UUID,
    status_in: StatusCreate, # Reuse create schema for simplicity
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Status).where(Status.id == status_id))
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
    db: AsyncSession = Depends(get_db)
):
    try:
        # Get tenant_id from first item or default
        tenant_id = None
        if statuses_in:
            tenant_id = statuses_in[0].get("tenant_id")
        
        if not tenant_id:
            # Fallback or error
            raise HTTPException(status_code=400, detail="Missing tenant_id in payload")

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
                query = select(Status).where(Status.id == sid)
                result = await db.execute(query)
                status = result.scalar_one_or_none()
                if status:
                    for key, value in item.items():
                        if hasattr(status, key) and key != "id":
                            setattr(status, key, value)
                    results.append(status)
            else:
                # Create
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
        print(f"BULK STATUS ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))
@router.delete("/{status_id}")
async def delete_status(
    status_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Status).where(Status.id == status_id))
    status = result.scalar_one_or_none()
    if not status:
        raise HTTPException(status_code=404, detail="Status not found")
    
    # Soft delete
    status.is_active = False
    await db.commit()
    return {"detail": "Status deactivated"}
