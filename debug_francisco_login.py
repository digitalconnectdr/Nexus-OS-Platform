import asyncio
import sys
import os
from sqlalchemy import text, select

# Setup Path
current_dir = os.getcwd()
backend_path = os.path.join(current_dir, "backend")
sys.path.insert(0, backend_path)
from dotenv import load_dotenv
load_dotenv(os.path.join(backend_path, ".env"))

from app.core.database import SessionLocal
from app.models.core import UserProfile, RolePermission

async def debug_user(email: str, tenant_id_prefix: str = None):
    print(f"\n--- Debugging User: {email} ---")
    async with SessionLocal() as db:
        # 1. Fetch User Profile
        stmt = select(UserProfile).where(UserProfile.email == email)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            print(f"❌ User not found.")
            return

        print(f"User ID: {user.id}")
        print(f"Role: {user.role}")
        print(f"Tenant ID: {user.tenant_id}")
        
        if tenant_id_prefix and str(user.tenant_id).startswith(tenant_id_prefix):
             print(f"✅ Tenant ID matches prefix {tenant_id_prefix}")
        elif tenant_id_prefix:
             print(f"⚠️ Tenant ID {user.tenant_id} DOES NOT match prefix {tenant_id_prefix}")

        # Check for NULLs in critical fields
        if not user.role: print("❌ Role is NULL")
        if not user.tenant_id: print("❌ Tenant ID is NULL")
        
        # 2. Fetch Permissions for Role & Tenant
        print(f"\n[Permissions for Role '{user.role}' in Tenant '{user.tenant_id}']")
        perm_stmt = select(RolePermission).where(
            RolePermission.role == user.role,
            RolePermission.tenant_id == user.tenant_id
        )
        perm_result = await db.execute(perm_stmt)
        perms = perm_result.scalars().all()
        
        allowed_count = 0
        for p in perms:
            if p.is_allowed:
                allowed_count += 1
                # Format: module:resource:action
                print(f"  ✅ {p.module}:{p.resource}:{p.action} (Name: {p.name})")
            else:
                print(f"  ❌ {p.module}:{p.resource}:{p.action} (Name: {p.name})")

        print(f"\nTotal Permissions Found: {len(perms)}")
        print(f"Allowed Permissions: {allowed_count}")

async def check_names_mapping(tenant_id: str):
    print(f"\n--- Checking Name vs Action Mapping for Tenant {tenant_id} ---")
    async with SessionLocal() as db:
        stmt = text("SELECT name, action, resource, module FROM role_permissions WHERE tenant_id = :tid LIMIT 20")
        result = await db.execute(stmt, {"tid": tenant_id})
        rows = result.fetchall()
        print(f"{'NAME':<40} | {'ACTION':<20} | {'RESOURCE':<20}")
        print("-" * 85)
        for row in rows:
            print(f"{str(row.name)[:40]:<40} | {str(row.action)[:20]:<20} | {str(row.resource)[:20]:<20}")

async def find_user_fuzzy(partial_email: str):
    print(f"\n--- Searching for user like '{partial_email}' ---")
    async with SessionLocal() as db:
        stmt = select(UserProfile).where(UserProfile.email.ilike(f"%{partial_email}%"))
        result = await db.execute(stmt)
        users = result.scalars().all()
        for u in users:
            print(f"Found: {u.email} (ID: {u.id}, Role: {u.role}, Tenant: {u.tenant_id})")
            if str(u.tenant_id) == 'fe0192a0-6e11-4f5e-b6ca-6505d7c1e85e': # JPRS
                 print("  -> MATCHES TARGET ORGANIZATION!")
                 # Check for NULLs
                 print(f"  Check: First Name={u.first_name}, Last Name={u.last_name}")

async def main():
    # 1. Mapeo de Nombres for DOFU (b23097fd...)
    # dofu_id = 'b23097fd-bd8f-4e13-82be-96a3fa6bd5ca'
    # await check_names_mapping(dofu_id)

    # 2. Francisco Tracking
    # await debug_user('fpolanco02@dofu.do', 'b23097fd') 
    
    # 3. Find Jcpenalo
    await find_user_fuzzy('jcpenalo')

if __name__ == "__main__":
    asyncio.run(main())
