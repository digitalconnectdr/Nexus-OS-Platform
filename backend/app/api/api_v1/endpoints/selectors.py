from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.api.deps import get_db
from app.core.security import get_current_user
from app.models.core import UserProfile, Campaign, Product
from app.models.status import Status
from pydantic import BaseModel
from uuid import UUID

router = APIRouter()

class SelectorOption(BaseModel):
    id: UUID
    name: str

class StatusSelectorOption(BaseModel):
    id: UUID
    name: str
    color_hex: str
    scope: str
    is_productive: bool

class ProductSelectorOption(BaseModel):
    id: UUID
    name: str
    family_name: str
    plan_name: str
    current_price: float
    current_pp: str
    current_concept: str

@router.get("/supervisors", response_model=List[SelectorOption])
async def get_supervisors_selector(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    """Returns a list of active supervisors for dropdowns."""
    query = (
        select(UserProfile.id, UserProfile.first_name, UserProfile.last_name, UserProfile.email)
        .where(
            UserProfile.tenant_id == current_user.tenant_id,
            UserProfile.is_active == True,
            UserProfile.is_deleted == False,
            UserProfile.role.ilike("%Supervisor%")
        )
    )
    result = await db.execute(query)
    selectors = []
    for row in result.all():
        full_name = f"{row.first_name} {row.last_name}".strip() or row.email
        selectors.append(SelectorOption(id=row.id, name=full_name.upper()))
    
    return selectors

@router.get("/campaigns", response_model=List[SelectorOption])
async def get_campaigns_selector(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    """Returns a list of active campaigns for dropdowns."""
    query = (
        select(Campaign.id, Campaign.name)
        .where(
            Campaign.tenant_id == current_user.tenant_id,
            Campaign.is_active == True
        )
    )
    result = await db.execute(query)
    return [SelectorOption(id=row.id, name=row.name.upper()) for row in result.all()]

@router.get("/products", response_model=List[ProductSelectorOption])
async def get_products_selector(
    campaign_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    """Returns a list of active products with public pricing data for dropdowns."""
    query = (
        select(
            Product.id, 
            Product.name, 
            Product.family_name, 
            Product.plan_name,
            Product.current_price,
            Product.current_pp,
            Product.current_concept
        )
        .where(
            Product.tenant_id == current_user.tenant_id,
            Product.is_active == True
        )
    )
    
    if campaign_id:
        query = query.where(Product.campaign_id == campaign_id)
        
    result = await db.execute(query)
    products = []
    for row in result.all():
        products.append(ProductSelectorOption(
            id=row.id,
            name=row.name.upper(),
            family_name=row.family_name.upper() if row.family_name else "GENERAL",
            plan_name=row.plan_name.upper() if row.plan_name else row.name.upper(),
            current_price=float(row.current_price or 0.0),
            current_pp=row.current_pp or "N/A",
            current_concept=row.current_concept or "N/A"
        ))
    return products

@router.get("/statuses", response_model=List[StatusSelectorOption])
async def get_statuses_selector(
    db: AsyncSession = Depends(get_db),
    current_user: UserProfile = Depends(get_current_user)
):
    """Returns a list of active sales statuses for dropdowns with metadata."""
    query = (
        select(Status.id, Status.name, Status.color_hex, Status.scope, Status.is_productive)
        .where(
            Status.tenant_id == current_user.tenant_id,
            Status.is_active == True
        )
    )
    result = await db.execute(query)
    return [
        StatusSelectorOption(
            id=row.id, 
            name=str(row.name),
            color_hex=row.color_hex or "#CBD5E0",
            scope=row.scope or "DASHBOARD",
            is_productive=row.is_productive
        ) for row in result.all()
    ]
