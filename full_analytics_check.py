import asyncio
import os
import sys
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from dotenv import load_dotenv

# Add current dir to sys.path
sys.path.append(os.getcwd() + "/backend")

# Load environment variables
load_dotenv("backend/.env")

from app.core.database import SessionLocal
from app.models.core import UserProfile, SalesOrder

async def diagnostic():
    async with SessionLocal() as db:
        tenant_id = "9ab69930-b675-4054-af33-0fb080182006" # Demo Company
        start_date = "2025-11-04"
        end_date = "2026-02-01"
        
        print(f"=== ROLES & ASSIGNMENTS DIAGNOSTIC ({tenant_id}) ===")
        
        # 1. User Roles Distribution
        role_stmt = select(UserProfile.role, func.count(UserProfile.id)).where(UserProfile.tenant_id == tenant_id).group_by(UserProfile.role)
        role_result = await db.execute(role_stmt)
        print("User Roles:")
        for role, count in role_result.all():
            print(f"  - {role}: {count}")
            
        # 2. Sales with Digitizer ID
        digitizer_stmt = select(func.count(SalesOrder.id)).where(
            SalesOrder.tenant_id == tenant_id,
            SalesOrder.digitizer_id.is_not(None),
            SalesOrder.created_at >= datetime.strptime(start_date, "%Y-%m-%d"),
            SalesOrder.created_at <= datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")
        )
        d_result = await db.execute(digitizer_stmt)
        d_count = d_result.scalar()
        print(f"Sales with digitizer_id (Nov-Feb): {d_count}")
        
        # 3. Check specific digitizer roles
        if d_count > 0:
            d_role_stmt = select(UserProfile.role, func.count(SalesOrder.id)).join(
                UserProfile, SalesOrder.digitizer_id == UserProfile.id
            ).where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.created_at >= datetime.strptime(start_date, "%Y-%m-%d")
            ).group_by(UserProfile.role)
            d_role_result = await db.execute(d_role_stmt)
            print("Roles of users who are digitizers in sales:")
            for role, count in d_role_result.all():
                print(f"  - {role}: {count}")

if __name__ == "__main__":
    asyncio.run(diagnostic())
