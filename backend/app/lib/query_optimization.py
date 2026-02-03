"""
Query optimization utilities
Provides helper functions for eager loading and preventing N+1 queries
"""
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import logging

from app.models import User, SalesOrder, SalesGoal, Campaign, Product, Status

logger = logging.getLogger(__name__)


async def get_users_with_relationships(
    db: AsyncSession,
    supervisor_id: Optional[str] = None,
    include_goals: bool = False,
    include_sales: bool = False
) -> List[User]:
    """
    Get users with eager-loaded relationships to prevent N+1 queries
    
    Args:
        db: Database session
        supervisor_id: Filter by supervisor (optional)
        include_goals: Load sales goals relationship
        include_sales: Load sales orders relationship
    
    Returns:
        List of users with loaded relationships
    """
    query = select(User)
    
    # Add eager loading
    if include_goals:
        query = query.options(selectinload(User.sales_goals))
    
    if include_sales:
        query = query.options(selectinload(User.sales_orders))
    
    # Filter
    if supervisor_id:
        query = query.where(
            (User.id == supervisor_id) | (User.supervisor_id == supervisor_id)
        )
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_sales_orders_with_relationships(
    db: AsyncSession,
    start_date: str,
    end_date: str,
    agent_id: Optional[str] = None,
    campaign_id: Optional[str] = None
) -> List[SalesOrder]:
    """
    Get sales orders with eager-loaded relationships
    Prevents N+1 queries when accessing agent, campaign, product, status
    
    Args:
        db: Database session
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        agent_id: Filter by agent (optional)
        campaign_id: Filter by campaign (optional)
    
    Returns:
        List of sales orders with loaded relationships
    """
    query = select(SalesOrder).options(
        joinedload(SalesOrder.agent),
        joinedload(SalesOrder.campaign),
        joinedload(SalesOrder.product),
        joinedload(SalesOrder.status)
    )
    
    # Date filter
    query = query.where(
        SalesOrder.created_at >= start_date,
        SalesOrder.created_at <= end_date
    )
    
    # Optional filters
    if agent_id:
        query = query.where(SalesOrder.agent_id == agent_id)
    
    if campaign_id:
        query = query.where(SalesOrder.campaign_id == campaign_id)
    
    result = await db.execute(query)
    return result.scalars().unique().all()


async def get_goals_with_relationships(
    db: AsyncSession,
    month: str,
    user_id: Optional[str] = None,
    campaign_id: Optional[str] = None
) -> List[SalesGoal]:
    """
    Get sales goals with eager-loaded relationships
    
    Args:
        db: Database session
        month: Month (YYYY-MM)
        user_id: Filter by user (optional)
        campaign_id: Filter by campaign (optional)
    
    Returns:
        List of goals with loaded relationships
    """
    query = select(SalesGoal).options(
        joinedload(SalesGoal.user),
        joinedload(SalesGoal.campaign)
    )
    
    # Month filter
    query = query.where(SalesGoal.month == month)
    
    # Optional filters
    if user_id:
        query = query.where(SalesGoal.user_id == user_id)
    
    if campaign_id:
        query = query.where(SalesGoal.campaign_id == campaign_id)
    
    result = await db.execute(query)
    return result.scalars().unique().all()


async def get_campaigns_with_products(
    db: AsyncSession,
    is_active: Optional[bool] = None
) -> List[Campaign]:
    """
    Get campaigns with their products loaded
    
    Args:
        db: Database session
        is_active: Filter by active status (optional)
    
    Returns:
        List of campaigns with loaded products
    """
    query = select(Campaign).options(
        selectinload(Campaign.products)
    )
    
    if is_active is not None:
        query = query.where(Campaign.is_active == is_active)
    
    result = await db.execute(query)
    return result.scalars().all()


# Batch loading utility
async def batch_load_relationships(
    db: AsyncSession,
    objects: List,
    relationship_name: str
):
    """
    Batch load a relationship for a list of objects
    Useful for loading relationships after initial query
    
    Args:
        db: Database session
        objects: List of ORM objects
        relationship_name: Name of relationship to load
    """
    if not objects:
        return
    
    # Get the relationship attribute
    model_class = type(objects[0])
    relationship = getattr(model_class, relationship_name)
    
    # Load all related objects in one query
    ids = [obj.id for obj in objects]
    related_query = select(relationship.property.mapper.class_).where(
        relationship.property.mapper.class_.id.in_(ids)
    )
    
    await db.execute(related_query)
    logger.debug(f"Batch loaded {relationship_name} for {len(objects)} objects")
