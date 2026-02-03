import asyncio
import os
import sys
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from dotenv import load_dotenv

# Add current dir to sys.path
sys.path.append(os.getcwd() + "/backend")

# Load environment variables
load_dotenv("backend/.env")

from app.core.database import SessionLocal
from app.models.core import SalesOrder

async def migrate_status():
    async with SessionLocal() as db:
        tenant_id = "9ab69930-b675-4054-af33-0fb080182006" # Demo Company
        target_status = "Completada"
        source_status = "Approved"
        
        print(f"=== MIGRATING STATUS '{source_status}' -> '{target_status}' ===")
        print(f"Tenant: {tenant_id}")
        
        # 1. Count records to update
        count_stmt = select(func.count(SalesOrder.id)).where(
            SalesOrder.tenant_id == tenant_id,
            SalesOrder.status == source_status
        )
        count_res = await db.execute(count_stmt)
        count = count_res.scalar()
        
        print(f"Found {count} records to update.")
        
        if count > 0:
            # 2. Perform Update
            update_stmt = update(SalesOrder).where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.status == source_status
            ).values(status=target_status)
            
            await db.execute(update_stmt)
            await db.commit()
            print("✅ Update completed successfully.")
        else:
            print("No records to update.")

if __name__ == "__main__":
    asyncio.run(migrate_status())
