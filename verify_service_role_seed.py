import asyncio
import sys
import os
import uuid
import logging

# Configure logging to show info
logging.basicConfig(level=logging.INFO)

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import SessionLocal
from app.models.core import Organization
from app.core.permissions_seed import initialize_organization_permissions
from sqlalchemy import text

async def main():
    async with SessionLocal() as db:
        print("\n=== VALIDANDO USO DE SERVICE KEY ===")
        
        # 1. Create Dummy Org (SQLAlchemy)
        test_name = "SERVICE_ROLE_TEST_ORG"
        test_id = uuid.uuid4()
        
        print(f"🏭 Creating SQL Org: {test_name}")
        org = Organization(id=test_id, name=test_name, slug=f"svc-test-{test_id.hex[:6]}")
        db.add(org)
        await db.commit()
        
        try:
            # 2. Call Seeder (Uses Supabase Admin Client)
            print("🚀 Invoking Seeder (Expecting Service Role Logs)...")
            await initialize_organization_permissions(db, test_id)
            
            # 3. Verify
            # Check via SQL for speed
            count = await db.scalar(text(f"SELECT count(*) FROM role_permissions WHERE tenant_id = '{test_id}'"))
            print(f"\n✅ Verification Result: {count} permissions created.")
            
            if count == 473:
                print("🏆 SUCCESS: Matrix Cloned via Service Key.")
            else:
                print("❌ FAILURE: Permissions count mismatch.")
                
        except Exception as e:
            print(f"❌ ERROR: {e}")
        finally:
            # Cleanup
            print("🧹 Cleanup...")
            # Delete Org (Cascade should clean perms)
            await db.execute(text(f"DELETE FROM organizations WHERE id = '{test_id}'"))
            await db.commit()
            print("✨ Cleanup Done.")

if __name__ == "__main__":
    asyncio.run(main())
