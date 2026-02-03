import asyncio
import os
import sys
from sqlalchemy import select
from dotenv import load_dotenv

# Add current dir to sys.path
sys.path.append(os.getcwd() + "/backend")

# Load environment variables
load_dotenv("backend/.env")

from app.core.database import SessionLocal
from app.models.core import UserProfile

# Mock Dependencies
current_user = None

async def test_endpoint_logic():
    async with SessionLocal() as db:
        # 1. Simulate Operational Query for 2025-12
        month = "2025-12"
        tenant_id = "9ab69930-b675-4054-af33-0fb080182006"
        
        print(f"=== TESTING MONTH: {month} ===")
        
        # Check active non-admin users
        u_stmt = select(UserProfile).where(
            UserProfile.tenant_id == tenant_id,
            UserProfile.is_active == True,
            UserProfile.role.notin_(['Super Admin', 'Administrador'])
        )
        u_res = await db.execute(u_stmt)
        users = u_res.scalars().all()
        print(f"Found {len(users)} eligible operational users.")
        
        # Check Backoffice Query for 2025-12
        from app.models.core import SalesOrder
        
        start_ts = f"{month}-01T00:00:00Z"
        end_ts = f"{month}-31T23:59:59Z"
        
        sales_stmt = select(SalesOrder.id, SalesOrder.digitizer_id).where(
            SalesOrder.tenant_id == tenant_id,
            SalesOrder.created_at >= start_ts,
            SalesOrder.created_at <= end_ts
        )
        sales_res = await db.execute(sales_stmt)
        sales = sales_res.all()
        print(f"Found {len(sales)} sales in {month}.")
        
        digitizer_ids = {s.digitizer_id for s in sales if s.digitizer_id}
        print(f"Unique Digitizers in sales: {len(digitizer_ids)}")

if __name__ == "__main__":
    asyncio.run(test_endpoint_logic())
