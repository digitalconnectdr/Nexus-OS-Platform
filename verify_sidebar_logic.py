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

# Simulation of Sidebar Logic
SIDEBAR_ITEMS = [
    {'label': 'Dashboard', 'module': 'dashboard', 'resource': 'dashboard', 'action': 'read'}, # Legacy 'read'
    {'label': 'Historial', 'module': 'history', 'resource': 'history', 'action': 'read'},
    {'label': 'Organizaciones', 'module': 'policies', 'resource': 'organizations', 'action': 'view_tab'}, # New 'view_tab'
    {'label': 'Usuarios', 'module': 'config_users', 'resource': 'users', 'action': 'read'},
    {'label': 'Competencias', 'module': 'competencias', 'resource': 'tournaments', 'action': 'view_module'},
]

async def check_permissions(user_email: str, tenant_id_prefix: str = None):
    print(f"\n==================================================")
    print(f"Verifying Sidebar Logic for: {user_email}")
    print(f"==================================================")

    async with SessionLocal() as db:
        # 1. Fetch User
        stmt = select(UserProfile).where(UserProfile.email == user_email)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            print(f"❌ User not found: {user_email}")
            return

        print(f"User Role: {user.role}")
        print(f"Tenant: {user.tenant_id}")
        
        is_super_admin = user.role == "Super Admin"
        if is_super_admin:
            print("🚀 SUPER ADMIN DETECTED - BYPASS ACTIVE")

        # 2. Fetch Actual Permissions
        perm_stmt = select(RolePermission).where(
            RolePermission.role == user.role,
            RolePermission.tenant_id == user.tenant_id,
            RolePermission.is_allowed == True
        )
        perm_result = await db.execute(perm_stmt)
        # Store as set of "module:resource:action"
        db_perms = {f"{p.module}:{p.resource}:{p.action}" for p in perm_result.scalars().all()}
        
        print(f"Active DB Permissions: {len(db_perms)}")

        # 3. Simulate "Smart Check"
        print("\n--- Sidebar Rendering Simulation ---")
        visible_items = []
        for item in SIDEBAR_ITEMS:
            has_access = False
            
            # Logic: 
            # 1. Super Admin -> True
            # 2. DB has exact match
            # 3. Smart Fallback (read <-> view_tab)
            
            req_key = f"{item['module']}:{item['resource']}:{item['action']}"
            
            if is_super_admin:
                has_access = True
                reason = "Super Admin Bypass"
            elif req_key in db_perms:
                has_access = True
                reason = "Exact Match"
            else:
                # Smart Logic Simulation
                if item['action'] == 'read':
                    alt_key = f"{item['module']}:{item['resource']}:view_tab"
                    if alt_key in db_perms:
                        has_access = True
                        reason = f"Smart Match (read -> view_tab)"
                elif item['action'] == 'view_tab':
                    alt_key = f"{item['module']}:{item['resource']}:read"
                    if alt_key in db_perms:
                        has_access = True
                        reason = f"Smart Match (view_tab -> read)"
            
            status_icon = "✅" if has_access else "❌"
            print(f"{status_icon} Item: {item['label']:<20} | Req: {item['action']:<10} | Result: {reason if has_access else 'DENIED'}")
            
            if has_access:
                visible_items.append(item['label'])

        print(f"\n>>> Final Rendered Sidebar: {visible_items}")
        if len(visible_items) == 0:
            print("❌ FAILURE: Sidebar is empty!")
        else:
            print("✅ SUCCESS: Sidebar rendered contents.")

async def main():
    # Francisco (Admin)
    await check_permissions('fpolanco02@dofu.do')
    
    # Jcpenalo (Super Admin) - using one of the emails found
    await check_permissions('jcpenalo@gmail.com')

if __name__ == "__main__":
    asyncio.run(main())
