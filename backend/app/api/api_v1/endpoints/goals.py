from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from app.api.deps import get_db
from app.models.sales_goal import SalesGoal
from app.models.core import UserProfile, Campaign
from app.schemas.goal_schemas import SalesGoalResponse as MonthlyGoalOut, SalesGoalCreate as MonthlyGoalCreate, SalesGoalUpdate as MonthlyGoalUpdate, SalesGoalBulkCreate as MonthlyGoalBulkCreate
from app.schemas.core import PaginatedResponse
from app.api.pagination import CommonQueryParams, apply_pagination_logic
from uuid import UUID

router = APIRouter()

@router.post("/bulk", response_model=List[MonthlyGoalOut])
async def create_goals_bulk(
    goals_in: MonthlyGoalBulkCreate,
    db: AsyncSession = Depends(get_db)
):
    new_goals = []
    for goal_item in goals_in.items:
        goal_data = goal_item.model_dump()
        if goal_data.get("product_family"):
            goal_data["product_family"] = goal_data["product_family"].upper()
            
        goal = SalesGoal(**goal_data)
        db.add(goal)
        new_goals.append(goal)
    
    await db.commit()
    
    # Recargar con relaciones para la serialización
    goal_ids = [g.id for g in new_goals]
    result = await db.execute(
        select(SalesGoal)
        .where(SalesGoal.id.in_(goal_ids))
        .options(
            selectinload(SalesGoal.campaign).selectinload(Campaign.default_status),
            selectinload(SalesGoal.agent),
            selectinload(SalesGoal.product)
        )
    )
    return result.scalars().all()

@router.get("/", response_model=PaginatedResponse[MonthlyGoalOut])
async def list_goals(
    db: AsyncSession = Depends(get_db),
    params: CommonQueryParams = Depends(),
    include_inactive: bool = False
):
    query = (
        select(SalesGoal)
        .join(UserProfile, SalesGoal.user_id == UserProfile.id)
        .join(Campaign, SalesGoal.campaign_id == Campaign.id)
        .where(UserProfile.is_deleted == False)
        .options(
            selectinload(SalesGoal.campaign).selectinload(Campaign.default_status),
            selectinload(SalesGoal.agent),
            selectinload(SalesGoal.product)
        )
    )
    
    if not include_inactive:
        query = query.where(SalesGoal.is_active == True)
    
    if params.search:
        from sqlalchemy import or_
        search_filter = f"%{params.search}%"
        query = query.where(
            or_(
                Campaign.name.ilike(search_filter),
                UserProfile.first_name.ilike(search_filter),
                UserProfile.last_name.ilike(search_filter),
                UserProfile.email.ilike(search_filter)
            )
        )
    
    return await apply_pagination_logic(
        db=db,
        model=SalesGoal,
        params=params,
        base_query=query,
        search_fields=[] # Handled manually above for complex joins
    )

@router.post("/", response_model=MonthlyGoalOut)
async def create_goal(
    goal_in: MonthlyGoalCreate,
    db: AsyncSession = Depends(get_db)
):
    goal_data = goal_in.model_dump()
    if goal_data.get("product_family"):
        goal_data["product_family"] = goal_data["product_family"].upper()
        
    goal = SalesGoal(**goal_data)
    db.add(goal)
    await db.commit()
    
    # Fetch con relaciones para evitar LazyLoadingError / 500 en serialización
    result = await db.execute(
        select(SalesGoal)
        .where(SalesGoal.id == goal.id)
        .options(
            selectinload(SalesGoal.campaign).selectinload(Campaign.default_status),
            selectinload(SalesGoal.agent),
            selectinload(SalesGoal.product)
        )
    )
    return result.scalar_one()

@router.put("/{goal_id}", response_model=MonthlyGoalOut)
async def update_goal(
    goal_id: UUID,
    goal_in: MonthlyGoalUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SalesGoal)
        .where(SalesGoal.id == goal_id)
        .options(
            selectinload(SalesGoal.campaign).selectinload(Campaign.default_status),
            selectinload(SalesGoal.agent),
            selectinload(SalesGoal.product)
        )
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    update_data = goal_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "product_family" and value:
            value = value.upper()
        setattr(goal, key, value)
    
    await db.commit()
    await db.refresh(goal)
    return goal

@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(SalesGoal).where(SalesGoal.id == goal_id))
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    # Soft delete (Logical Deletion)
    goal.is_active = False
    await db.commit()
    return {"status": "success", "message": "Goal deactivated"}
