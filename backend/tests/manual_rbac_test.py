import asyncio
import sys
import os

# Add backend directory to path
current_dir = os.path.dirname(os.path.abspath(__file__)) # .../backend/tests
backend_dir = os.path.dirname(current_dir) # .../backend
sys.path.append(backend_dir)

from app.core.security import check_permission_programmatic
from app.schemas.user_schemas import UserRole
from app.models.core import UserProfile, RolePermission
from uuid import uuid4

class MockUser:
    def __init__(self, role, is_super_admin=False):
        self.role = role
        self.is_super_admin = is_super_admin
        self.tenant_id = uuid4()
        self.email = "test@nexus.os"

class MockSession:
    def __init__(self, permission_exists):
        self.permission_exists = permission_exists
        
    async def execute(self, query):
        return self
        
    def scalar_one_or_none(self):
        return "PERMISSION_FOUND" if self.permission_exists else None

async def test_rbac():
    print("--- STARTING RBAC SIMULATION ---")
    
    # CASE 1: Super Admin (Master Key)
    user_sa = MockUser("Super Admin", is_super_admin=True)
    db_sa = MockSession(permission_exists=False) # Even if DB says no
    result = await check_permission_programmatic(user_sa, db_sa, "data", "view_all", module="dashboard")
    print(f"1. Super Admin Bypass: {'✅ PASS' if result else '❌ FAIL'}")

    # CASE 2: Supervisor WITH permission
    user_sup = MockUser("Supervisor")
    db_with_perm = MockSession(permission_exists=True)
    result = await check_permission_programmatic(user_sup, db_with_perm, "data", "view_all", module="dashboard")
    print(f"2. Supervisor WITH perm: {'✅ PASS' if result else '❌ FAIL'}")

    # CASE 3: Supervisor WITHOUT permission
    db_no_perm = MockSession(permission_exists=False)
    result = await check_permission_programmatic(user_sup, db_no_perm, "data", "view_all", module="dashboard")
    print(f"3. Supervisor WITHOUT perm: {'✅ PASS' if not result else '❌ FAIL'}")
    
    # CASE 4: Normalization "super visor" -> "supervisor"
    user_typo = MockUser("Super visor")
    # Simulation assumes DB handles the normalized query, 
    # but here we test that the function doesn't crash
    try:
        await check_permission_programmatic(user_typo, db_with_perm, "data", "view_all", module="dashboard")
        print(f"4. Normalization Safety: ✅ PASS")
    except Exception as e:
        print(f"4. Normalization Safety: ❌ FAIL ({e})")

if __name__ == "__main__":
    asyncio.run(test_rbac())
