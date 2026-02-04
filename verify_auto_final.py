import asyncio
import sys
import os
import uuid
from types import SimpleNamespace

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import SessionLocal
from sqlalchemy import select, text, func
from app.models.core import Organization, RolePermission, UserProfile
from app.schemas.core import UserRole

# Import the actual endpoint function
from app.api.api_v1.endpoints.organizations import create_organization
from app.schemas.organization import OrganizationCreate

async def main():
    async with SessionLocal() as db:
        print("\n=== 1. PURGE CLEANUP (CASCADE TEST) ===")
        # Find DOFU orgs
        res = await db.execute(select(Organization).where(Organization.name.like('%DOFU%')))
        dofus = res.scalars().all()
        
        if not dofus:
            print("ℹ️ No DOFU organizations found to purge.")
        else:
            for org in dofus:
                print(f"💀 Purging '{org.name}' ({org.id})...")
                try:
                    # Physical delete to test CASCADE
                    await db.execute(text(f"DELETE FROM organizations WHERE id = '{org.id}'"))
                    await db.commit()
                    print(f"   ✅ Deleted '{org.name}'. Cascade worked (no FK error).")
                except Exception as e:
                    print(f"   ❌ FAILED to delete '{org.name}': {e}")
                    await db.rollback()

        print("\n=== 2. CREATING 'TEST_AUTO_FINAL' (ENDPOINT SIMULATION) ===")
        
        # Mocks
        mock_user = SimpleNamespace(
            id=uuid.uuid4(),
            role="Super Admin",
            tenant_id=uuid.uuid4() # Random
        )
        
        org_in = OrganizationCreate(name="TEST_AUTO_FINAL", slug="test-auto-final")
        
        # Call the endpoint function directly
        # Verification that the AUTO-SEED logic is INSIDE this function
        try:
            print(f"🏭 Invoking create_organization endpoint logic for '{org_in.name}'...")
            # We pass 'True' for permission check mock
            # Ensure we are passing the session yielded by the context manager or factory
            # In async_session_maker context, 'db' is the session.
            
            result_org = await create_organization(
                org_in=org_in,
                db=db,
                current_user=mock_user,
                _=True
            )
            print(f"✅ Organization Created: {result_org.id}")
            
            # Verify Permissions were seeded BY THE FUNCTION
            count = await db.scalar(select(func.count()).where(RolePermission.tenant_id == result_org.id))
            print(f"🔍 Permission Check for '{result_org.name}': {count}")
            
            if count == 473:
                print("✅ [PASS] AUTO-SEED WORKED INSTANTLY.")
            else:
                print(f"❌ [FAIL] Expected 473, got {count}. The seed logic inside create_organization failed.")
                
        except Exception as e:
            print(f"❌ ERROR calling endpoint: {e}")

if __name__ == "__main__":
    asyncio.run(main())
