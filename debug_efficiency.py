import asyncio
import os
import sys
import uuid
from datetime import date
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import create_async_session, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker

# Add current dir to sys.path
sys.path.append(os.getcwd() + "/backend")

from app.core.config import settings
from app.core.database import engine
from app.models.core import SalesOrder, UserProfile as User, Product, Campaign
from app.models.sales_goal import SalesGoal
from app.models.status import Status

async def debug_query():
    async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as db:
        month = "2026-01"
        # 1. Exact query from _get_supervisor_efficiency
        stmt = select(
            User.id.label("agent_id"), User.first_name, User.last_name, User.supervisor_id, User.avatar_url,
            SalesGoal.campaign_id, func.upper(func.coalesce(SalesGoal.product_family, 'GENERAL')).label("family"),
            SalesGoal.target_amount, SalesGoal.target_units,
            Campaign.name.label("campaign_name")
        ).select_from(User).join(SalesGoal, (User.id == SalesGoal.user_id) & (SalesGoal.month.like(f"{month}-%"))
        ).join(Campaign, SalesGoal.campaign_id == Campaign.id
        ).filter(User.is_active == True, User.is_deleted == False).limit(1)

        result = await db.execute(stmt)
        row = result.first()
        if row:
            print(f"Row Keys: {row._mapping.keys()}")
            print(f"Row Values: {row._mapping}")
        else:
            print("No data found for this month/query.")

if __name__ == "__main__":
    asyncio.run(debug_query())
