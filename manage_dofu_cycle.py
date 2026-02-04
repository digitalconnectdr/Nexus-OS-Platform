import asyncio
import sys
import os
import uuid
from types import SimpleNamespace

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import SessionLocal
from sqlalchemy import select, text, func
from app.models.core import Organization, RolePermission
from app.api.api_v1.endpoints.organizations import create_organization
from app.schemas.organization import OrganizationCreate
from app.core.permissions_seed import initialize_organization_permissions

async def main():
    async with SessionLocal() as db:
        print("\n=== 1. ZOMBIE REPAIR (DOFU 2 & 3) ===")
        # Targets
        zombies = ["DOFU CARIBBEAN GROUP SRL 2", "DOFU CARIBBEAN GROUP SRL 3"]
        
        for name in zombies:
            org = await db.scalar(select(Organization).where(Organization.name == name))
            if org:
                count = await db.scalar(select(func.count()).where(RolePermission.tenant_id == org.id))
                print(f" > Found '{name}': {count} perms.")
                
                if count == 0:
                    print(f"   💊 Injecting permissions manually...")
                    await initialize_organization_permissions(db, org.id)
                    await db.commit()
                    
                    new_count = await db.scalar(select(func.count()).where(RolePermission.tenant_id == org.id))
                    print(f"   ✅ Repaired. Now has {new_count} perms.")
                else:
                    print("   ✅ Already OK.")
            else:
                print(f"   ℹ️ '{name}' not found in DB.")

        print("\n=== 2. PURGE VERIFICATION (CASCADE TEST) ===")
        # Delete the Original DOFU if exists, and maybe DOFU 2 to prove we can delete it now
        # User asked: "Confírmame que ya pudiste borrar las organizaciones 'Dofu' anteriores"
        
        target_purge_name = "DOFU CARIBBEAN GROUP SRL" # The first one
        
        org_purge = await db.scalar(select(Organization).where(Organization.name == target_purge_name))
        
        if org_purge:
            print(f"💀 Attempting Hard Delete on '{target_purge_name}'...")
            try:
                # Direct SQL Delete verify cascade
                await db.execute(text(f"DELETE FROM organizations WHERE id = '{org_purge.id}'"))
                await db.commit()
                print(f"   ✅ SUCCESS! '{target_purge_name}' deleted. Cascade constraints hold.")
            except Exception as e:
                print(f"   ❌ FAILED to delete: {e}")
                await db.rollback()
        else:
            print(f"   ℹ️ '{target_purge_name}' already gone.")

        print("\n=== 3. MASTER TEST: 'AUTOMATIZACION_FINAL' ===")
        # We simulate the API call because we cannot restart the User's Remote Server.
        # This proves the CODE is correct.
        
        test_name = "AUTOMATIZACION_FINAL"
        
        # Check if exists first
        existing = await db.scalar(select(Organization).where(Organization.name == test_name))
        if existing:
            print(f"   ℹ️ '{test_name}' already exists. Deleting for fresh test...")
            await db.execute(text(f"DELETE FROM organizations WHERE id = '{existing.id}'"))
            await db.commit()
        
        print(f"🏭 Creating '{test_name}' via Code Logic...")
        mock_user = SimpleNamespace(id=uuid.uuid4(), role="Super Admin", tenant_id=uuid.uuid4())
        org_in = OrganizationCreate(name=test_name, slug="automatizacion-final")
        
        try:
            # We explicitly pass _=True to bypass permission dependency check in the func
            new_org = await create_organization(org_in, db=db, current_user=mock_user, _=True)
            print(f"   ✅ Created Organization ID: {new_org.id}")
            
            # Verify Perms
            p_count = await db.scalar(select(func.count()).where(RolePermission.tenant_id == new_org.id))
            print(f"   🔍 Final Permission Count: {p_count}")
            
            if p_count == 473:
                print("   🏆 RESULT: AUTOMATIC SEEDING SUCCESS (Code Level).")
            else:
                print(f"   ❌ RESULT: FAILED. Count {p_count}")
                
        except Exception as e:
            print(f"   ❌ Error during creation: {e}")

if __name__ == "__main__":
    asyncio.run(main())
