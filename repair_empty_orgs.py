import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import SessionLocal
from sqlalchemy import select, func, text
from app.models.core import Organization, RolePermission
from app.core.permissions_seed import initialize_organization_permissions

async def main():
    async with SessionLocal() as db:
        print("🔍 Scanning for empty organizations...")
        
        # Get all orgs
        orgs = (await db.execute(select(Organization))).scalars().all()
        
        fixed_count = 0
        
        for org in orgs:
            # Check perm count
            count = await db.scalar(select(func.count()).where(RolePermission.tenant_id == org.id))
            
            print(f" > {org.name} ({org.id}): {count} permissions")
            
            if count == 0:
                print(f"   ⚠️ EMPTY! Initializing permissions from JPRS Mold...")
                await initialize_organization_permissions(db, org.id)
                await db.commit()
                
                # Verify
                new_count = await db.scalar(select(func.count()).where(RolePermission.tenant_id == org.id))
                print(f"   ✅ Fixed. New Count: {new_count}")
                fixed_count += 1
            elif count < 100:
                print(f"   ⚠️ WARNING: Suspiciously low permission count ({count}). Skipping auto-fix to be safe.")
                
        print(f"\n✨ Repair Complete. Total repaired: {fixed_count}")

if __name__ == "__main__":
    asyncio.run(main())
