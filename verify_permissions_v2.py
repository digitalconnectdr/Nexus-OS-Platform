
import asyncio
import logging
from sqlalchemy import select, text
from app.core.database import SessionLocal as async_session_factory
from app.models.core import UserProfile, RolePermission, Organization

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TARGET_EMAIL = "jcpenalo@gmail.com"

async def verify():
    async with async_session_factory() as db:
        print(f" >>> 🕵️ Verifying permissions for {TARGET_EMAIL}...")
        
        # 1. Get User
        result = await db.execute(select(UserProfile).where(UserProfile.email == TARGET_EMAIL))
        user = result.scalar_one_or_none()
        
        if not user:
            print(f" ❌ User {TARGET_EMAIL} not found!")
            return
            
        print(f" ✅ User found: {user.email} | Role: {user.role} | Tenant: {user.tenant_id}")
        
        # 2. Check Permissions Count for Tenant
        p_res = await db.execute(text(f"SELECT count(*) FROM role_permissions WHERE tenant_id = '{user.tenant_id}'"))
        count = p_res.scalar()
        print(f" 📊 Permissions in Tenant {user.tenant_id}: {count}")
        
        if count == 0:
            print(" ❌ FATAL: No permissions active for this tenant.")
            return

        # 3. Simulate Checks (Soft Check)
        # We check if entries exist for this role
        role = str(user.role).lower()
        
        checks = [
            ("dashboard", "sales", "read"),
            ("performance", "performance", "read"),
            ("config_campaigns", "campaigns", "read"),
            ("config_users", "users", "create")
        ]
        
        print(f" 🔎 Checking specific keys for role '{role}'...")
        
        passed = 0
        for item in checks:
            module = item[0]
            resource = item[1] if len(item) == 2 else item[1] # If 2 args, resource=module usually? No, map logic differs.
            action = item[-1]
            resource_key = item[1] if len(item) == 3 else module # logic approximation
            
            # Correction based on map:
            # ("dashboard", "access") -> M:dashboard, R:dashboard, A:access
            # ("dashboard", "sales", "read") -> M:dashboard, R:sales, A:read
            
            if len(item) == 2:
                # M=R, A=action
                q = select(RolePermission).where(
                    RolePermission.role == role,
                    RolePermission.module == module,
                    RolePermission.resource == module,
                    RolePermission.action == action,
                    RolePermission.tenant_id == user.tenant_id,
                    RolePermission.is_allowed == True
                )
            else:
                 q = select(RolePermission).where(
                    RolePermission.role == role,
                    RolePermission.module == module, 
                    RolePermission.resource == resource,
                    RolePermission.action == action,
                    RolePermission.tenant_id == user.tenant_id, 
                    RolePermission.is_allowed == True
                )
            
            res = await db.execute(q)
            perm = res.scalar_one_or_none()
            
            status_icon = "✅" if perm else "❌"
            print(f"   {status_icon} Check {module}:{resource_key}:{action}")
            if perm: passed += 1
            
        print(f" 🏁 Verification Result: {passed}/{len(checks)} checks passed.")
        
        if user.role in ["super_admin", "Super Admin"] and passed < len(checks):
             print(" ⚠️ Note: Super Admin might have explicit bypass in code, preventing DB lookup failure from blocking access, but DB entries should still exist for matrix consistency!")

if __name__ == "__main__":
    asyncio.run(verify())
