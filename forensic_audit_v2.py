
import asyncio
from sqlalchemy import select, func, text
from app.core.database import SessionLocal
from app.models.core import RolePermission, UserProfile, Organization
from app.schemas.core import OrganizationOut
import json

async def run_audit():
    async with SessionLocal() as db:
        print("\n--- [AUDIT 1: DB ROLE STRINGS] ---")
        # Direct SQL for absolute truth
        res_perms = await db.execute(text("SELECT DISTINCT role FROM role_permissions"))
        roles_in_perms = [r[0] for r in res_perms]
        print(f"Roles in role_permissions: {roles_in_perms}")
        
        res_users = await db.execute(text("SELECT DISTINCT role FROM users_profiles"))
        roles_in_users = [r[0] for r in res_users]
        print(f"Roles in users_profiles: {roles_in_users}")

        print("\n--- [AUDIT 2: ORGANIZATIONS SCHEMA TRACEBACK SIMULATION] ---")
        try:
            # Fetch one organization and try to validate it with the schema causing issues
            res_org = await db.execute(select(Organization).limit(1))
            org = res_org.scalar_one_or_none()
            if org:
                print(f"Testing org: {org.name} (ID: {org.id})")
                print(f"Raw DB values: name={org.name}, slug={org.slug}, is_deleted={org.is_deleted}")
                # Try validation
                validated = OrganizationOut.model_validate(org)
                print("✅ Validation successful for OrganizationOut")
            else:
                print("⚠️ No organizations found in DB")
        except Exception as e:
            print("❌ VALIDATION ERROR DETECTED:")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_audit())
