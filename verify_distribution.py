import asyncio
import os
import sys
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from dotenv import load_dotenv

# Add current dir to sys.path
sys.path.append(os.getcwd() + "/backend")

# Load environment variables
load_dotenv("backend/.env")

from app.core.database import SessionLocal
from app.models.core import UserProfile, SalesOrder

async def verify_data_distribution():
    async with SessionLocal() as db:
        tenant_id = "9ab69930-b675-4054-af33-0fb080182006" # Demo Company
        
        print(f"=== DATA DISTRIBUTION VERIFICATION ===")
        
        # 1. Check Sales Status Distribution (Post-Migration)
        status_stmt = select(SalesOrder.status, func.count(SalesOrder.id)).where(SalesOrder.tenant_id == tenant_id).group_by(SalesOrder.status)
        status_res = await db.execute(status_stmt)
        print("\nSales Statuses:")
        for st, count in status_res.all():
            print(f"  {st}: {count}")
            
        # 2. Check Agent Roles for 'Completada' sales
        print("\nAgent Roles for 'Completada' sales:")
        agent_role_stmt = select(UserProfile.role, func.count(SalesOrder.id)).join(
            UserProfile, SalesOrder.agent_id == UserProfile.id
        ).where(
            SalesOrder.tenant_id == tenant_id,
            SalesOrder.status == 'Completada'
        ).group_by(UserProfile.role)
        
        agent_res = await db.execute(agent_role_stmt)
        results = agent_res.all()
        if not results:
            print("  No 'Completada' sales found linked to valid users.")
        for role, count in results:
            print(f"  {role}: {count}")
            
        # 3. Check Sales Dates min/max
        date_stmt = select(func.min(SalesOrder.created_at), func.max(SalesOrder.created_at)).where(SalesOrder.tenant_id == tenant_id)
        date_res = await db.execute(date_stmt)
        min_date, max_date = date_res.first()
        print(f"\nSales Range: {min_date} to {max_date}")

        # 4. Check 'Seguimiento' users existence
        seg_stmt = select(UserProfile.first_name, UserProfile.role, UserProfile.is_active).where(
            UserProfile.tenant_id == tenant_id,
            UserProfile.role.ilike('%Seguimiento%')
        )
        seg_res = await db.execute(seg_stmt)
        print("\nSeguimiento Users:")
        for r in seg_res.all():
            print(f"  {r.first_name} ({r.role}) - Active: {r.is_active}")

if __name__ == "__main__":
    asyncio.run(verify_data_distribution())
