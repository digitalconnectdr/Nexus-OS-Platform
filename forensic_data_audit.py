
import asyncio
from sqlalchemy import select, text
from app.core.database import SessionLocal
from app.models.core import Organization, RolePermission, UserProfile
from app.schemas.organization import OrganizationOut
from app.schemas.core import UserRole
import pydantic

async def forensic_audit():
    async with SessionLocal() as db:
        print("\n=== 🔍 FORENSIC AUDIT START ===\n")

        # 1. ORGANIZATION DATA AUDIT
        print("--- [1. ORGANIZATION DATA VALIDATION] ---")
        orgs_res = await db.execute(select(Organization))
        orgs = orgs_res.scalars().all()
        
        failed_orgs = 0
        for org in orgs:
            print(f"Checking Org ID: {org.id} | Name: '{org.name}' | Slug: '{org.slug}' | Deleted: {org.is_deleted}")
            
            # Check for structural issues in DB
            if org.name is None:
                print(f"❌ CRITICAL: Org {org.id} has NULL name!")
            if not org.slug:
                print(f"❌ CRITICAL: Org {org.id} has empty/NULL slug!")
                
            # Simulate Schema Validation (OrganizationOut)
            try:
                OrganizationOut.model_validate(org)
            except pydantic.ValidationError as e:
                failed_orgs += 1
                print(f"❌ SCHEMA CRASH (OrganizationOut): {e}")

        if failed_orgs == 0:
            print("✅ All organizations passed OrganizationOut schema validation.")
        else:
            print(f"⚠️ Found {failed_orgs} organizations failing schema validation.")


        # 2. PERMISSION LOGIC SIMULATION (SUPER ADMIN)
        print("\n--- [2. PERMISSION MATRIX SIMULATION (SUPER ADMIN)] ---")
        
        # Mocking the query from permissions.py list_permissions
        # We assume current_user is Super Admin, so NO FILTER on role should be applied logic-wise
        # But we need to see what the actual code does vs what is in DB.
        
        # Let's pick a tenant to test (Demo Company)
        tenant_id = orgs[0].id if orgs else None
        if not tenant_id:
            print("❌ No tenant found to test permissions.")
            return

        print(f"Testing permissions for Tenant ID: {tenant_id}")
        
        stmt = select(RolePermission).where(RolePermission.tenant_id == tenant_id)
        
        # NOTE: In permissions.py, there is this logic:
        # if current_user.role != UserRole.SUPER_ADMIN:
        #     stmt = stmt.where(RolePermission.role == current_user.role)
        
        # We are simulating SUPER ADMIN, so we DO NOT apply that filter.
        # We execute the raw query that Super Admin would run.
        
        result = await db.execute(stmt)
        perms = result.scalars().all()
        
        print(f"Total Permission Rows Found: {len(perms)}")
        
        roles_found = set()
        for p in perms:
            roles_found.add(p.role)
            
        print(f"Roles returned in JSON: {sorted(list(roles_found))}")
        
        expected_roles = {
            "super_admin", "administrador", "gerente", "supervisor_senior", 
            "supervisor", "representante", "dpto_estadistica", 
            "seguimiento", "auditor_calidad", "digitacion", "cliente"
        }
        
        missing = expected_roles - roles_found
        if missing:
            print(f"❌ MISSING ROLES IN OUTPUT: {missing}")
        else:
            print("✅ All expected roles are present in the dataset.")

        print("\n=== 🏁 AUDIT COMPLETE ===")

if __name__ == "__main__":
    asyncio.run(forensic_audit())
