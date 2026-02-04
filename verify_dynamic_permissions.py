import asyncio
import os
import sys
import uuid

# Add backend to sys.path
current_dir = os.getcwd()
backend_dir = os.path.join(current_dir, "backend")
sys.path.append(backend_dir)

from sqlalchemy import select, update, delete, func
from app.core.database import SessionLocal
from app.models.core import RolePermission

TEST_RESOURCE = "test_dynamic_verification"
TEST_ACTION = "read"
TEST_ROLE = "Supervisor" 

async def verify_dynamic_permissions():
    async with SessionLocal() as db:
        print(f"--- Starting Dynamic Permission Verification for Role: {TEST_ROLE} ---")
        
        # 1. Get a distinct tenant_id (or just pick one from RolePermission)
        result = await db.execute(select(RolePermission.tenant_id).limit(1))
        tenant_id = result.scalar()
        
        if not tenant_id:
            print("No tenants found in RolePermission. Cannot test.")
            return

        print(f"Using Tenant ID: {tenant_id}")

        # 2. Cleanup any previous test data
        await db.execute(delete(RolePermission).where(
            RolePermission.role == TEST_ROLE,
            RolePermission.resource == TEST_RESOURCE,
            RolePermission.action == TEST_ACTION,
            RolePermission.tenant_id == tenant_id
        ))
        await db.commit()

        # 3. Insert ALLOWED permission
        print(f"-> Inserting permission: {TEST_RESOURCE}:{TEST_ACTION} = ALLOWED")
        perm_allowed = RolePermission(
            tenant_id=tenant_id,
            role=TEST_ROLE,
            resource=TEST_RESOURCE,
            action=TEST_ACTION,
            is_allowed=True,
            module="test_module",
            name="Test Permission"
        )
        db.add(perm_allowed)
        await db.commit()

        # 4. Check logic (Simulating check_permission query)
        query = select(RolePermission).where(
            func.lower(RolePermission.role) == TEST_ROLE.lower(),
            func.lower(RolePermission.resource) == TEST_RESOURCE.lower(),
            func.lower(RolePermission.action) == TEST_ACTION.lower(),
            RolePermission.tenant_id == tenant_id
        )
        result = await db.execute(query)
        perm = result.scalar_one_or_none()
        
        if perm and perm.is_allowed:
            print("✅ TEST 1 PASSED: Permission is correctly identified as ALLOWED.")
        else:
            print("❌ TEST 1 FAILED: Permission should be ALLOWED but is not.")
            return

        # 5. Update to DENIED
        print(f"-> Updating permission: {TEST_RESOURCE}:{TEST_ACTION} = DENIED (is_allowed=False)")
        perm.is_allowed = False
        await db.commit() # Commit update

        # 6. Check logic again
        result = await db.execute(query)
        perm = result.scalar_one_or_none()
        
        if perm and not perm.is_allowed:
             print("✅ TEST 2 PASSED: Permission is correctly identified as DENIED after update.")
        else:
             print(f"❌ TEST 2 FAILED: Permission should be DENIED. Got perm={perm}, is_allowed={perm.is_allowed if perm else 'None'}")
             return

        # 7. Cleanup
        print("-> Cleaning up test data...")
        await db.execute(delete(RolePermission).where(
            RolePermission.role == TEST_ROLE,
            RolePermission.resource == TEST_RESOURCE,
            RolePermission.action == TEST_ACTION,
            RolePermission.tenant_id == tenant_id
        ))
        await db.commit()
        print("--- Verification Complete: Dynamic Permissions are Working ---")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(verify_dynamic_permissions())
