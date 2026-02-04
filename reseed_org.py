import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import SessionLocal
from sqlalchemy import select, text
from app.models.core import Organization, RolePermission
from app.core.permissions_seed import initialize_organization_permissions

async def main():
    async with SessionLocal() as db:
        # 1. FIND ORG
        org = await db.scalar(select(Organization).where(Organization.name == 'Org Prueba Matriz'))
        if not org:
            print("❌ 'Org Prueba Matriz' NOT FOUND.")
            # Fallback for verifying logic on another org if needed, but safe to exit
            return

        print(f"🎯 Target Org: {org.name} ({org.id})")
        
        # 2. DELETE EXISTING PERMISSIONS
        # The user said "Borra todos los permisos mal creados"
        print("🗑️ Deleting existing 'Auto-Seeded' permissions...")
        await db.execute(text(f"DELETE FROM role_permissions WHERE tenant_id = '{org.id}'"))
        await db.commit()
        print("✅ Permissions wiped.")
        
        # 3. RE-SEED CLONING JPRS
        print("🧬 Applying JPRS Mold...")
        await initialize_organization_permissions(db, org.id)
        await db.commit()
        
        # 4. VERIFY
        count = await db.scalar(text(f"SELECT count(*) FROM role_permissions WHERE tenant_id = '{org.id}'"))
        print(f"✅ Re-seed Complete. New Permission Count: {count}")
        
        # 5. SAMPLE CHECK
        # Show a few to confirm names are correct (no prefixes)
        sample = await db.execute(text(f"SELECT name, module FROM role_permissions WHERE tenant_id = '{org.id}' LIMIT 5"))
        print("\n--- SAMPLE NEW PERMISSIONS ---")
        for row in sample:
            print(f"[{row[1]}] {row[0]}")

if __name__ == "__main__":
    asyncio.run(main())
