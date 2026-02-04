import asyncio
import sys
import os
import uuid
import logging
from sqlalchemy import select, func

# Setup Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import SessionLocal
from app.models.core import Organization, RolePermission
from app.core.permissions_seed import initialize_organization_permissions

async def debug_simulate_creation():
    async with SessionLocal() as db:
        print("🧪 [TEST] Starting Atomic Creation Simulation...")
        
        # 1. Create Dummy Org
        test_id = uuid.uuid4()
        test_name = f"TEST_SIMULA_{test_id.hex[:6]}"
        
        print(f"   > Creating Org: {test_name} ({test_id})")
        db_org = Organization(
            id=test_id,
            name=test_name,
            slug=test_name.lower()
        )
        
        try:
            # 2. Add & Flush (Mimic endpoints logic)
            db.add(db_org)
            await db.flush() # CRITICAL STEP
            print("   > Org Add + Flush: OK")
            
            # 3. Call Seeder
            print("   > Calling Seeder...")
            await initialize_organization_permissions(test_id, db)
            print("   > Seeder Returned: OK")
            
            # 4. Commit
            await db.commit()
            print("   > Commit: OK")
            
            # 5. VERIFY
            print("🔍 [TEST] Verifying Persistence...")
            perm_count = await db.scalar(select(func.count()).select_from(RolePermission).where(RolePermission.tenant_id == test_id))
            print(f"   > Permission Count for {test_name}: {perm_count}")
            
            if perm_count > 0:
                print("✅ TEST PASSED: Transaction successfully persisted Org + Permissions.")
            else:
                print("❌ TEST FAILED: Org created but Permissions are 0.")
                
            # Cleanup (Optional, but good for hygiene)
            # await db.delete(db_org)
            # await db.commit()
            
        except Exception as e:
            print(f"❌ TEST FAILED with Exception: {e}")
            await db.rollback()

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(debug_simulate_creation())
