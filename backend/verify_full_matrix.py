
import asyncio
import os
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update, text
from dotenv import load_dotenv
import sys

# --- SETUP ---
base_dir = os.path.dirname(os.path.abspath(__file__))
# If running from backend/ directly, base_dir is backend.
# If running from root, we need to ensure backend is in path.
if "backend" in base_dir:
    sys.path.append(base_dir)
elif os.path.join(os.getcwd(), "backend") not in sys.path:
    sys.path.append(os.path.join(os.getcwd(), "backend"))
base_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(base_dir, '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
# Fix: Ensure asyncpg driver is used for AsyncEngine
# DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://") 

# Mock UserProfile
class MockUser:
    def __init__(self, tenant_id, role, email="test@example.com"):
        self.tenant_id = tenant_id
        self.role = role
        self.email = email

# Re-implementing simplified check_permission logic for testing
# We replicate the query logic to verify the DB state matches expectations.
async def verify_permission(db: AsyncSession, user: MockUser, module: str, resource: str, action: str):
    from app.models.core import RolePermission
    from sqlalchemy import func
    
    # Logic mirror from security.py
    role_str = user.role
    
    filters = [
        RolePermission.role == role_str,
        func.lower(RolePermission.resource) == resource.lower(),
        func.lower(RolePermission.action) == action.lower(),
        RolePermission.tenant_id == user.tenant_id
    ]
    if module:
        filters.append(func.lower(RolePermission.module) == module.lower())
        
    query = select(RolePermission).where(*filters)
    result = await db.execute(query)
    perm = result.scalar_one_or_none()
    
    # Super Admin bypass handled in upper layer, but for matrix check we want to see if the record exists/allows.
    # If user is Super Admin, usually logic returns True immediately.
    # But for matrix validation, we check if the DB record exists/is_allowed.
    
    return perm

async def run_verification():
    # Fix for pgbouncer/prepared statement errors
    engine = create_async_engine(
        DATABASE_URL,
        connect_args={"statement_cache_size": 0}
    )
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    # 1. SETUP TEST ORGANIZATIONS
    async with AsyncSessionLocal() as db:
        print("🛠️  Creating Test Organizations...")
        # Cleanup PREVIOUS run if failed
        await db.execute(text("DELETE FROM role_permissions WHERE tenant_id IN (SELECT id FROM organizations WHERE slug IN ('test-org-a', 'test-org-b'))"))
        await db.execute(text("DELETE FROM organizations WHERE slug IN ('test-org-a', 'test-org-b')"))
        await db.commit()

        org_a_id = uuid.uuid4()
        org_b_id = uuid.uuid4()
        
        # Create temp orgs
        await db.execute(text("INSERT INTO organizations (id, name, slug) VALUES (:id, :name, :slug)"), 
                         [{"id": org_a_id, "name": "TEST_ORG_A", "slug": "test-org-a"},
                          {"id": org_b_id, "name": "TEST_ORG_B", "slug": "test-org-b"}])
        
        # Clone permissions to them (using our catalog logic)
        # We need the JPRS source to copy structure.
        JPRS_ID = "fe0192a0-6e11-4f5e-b6ca-6505d7c1e85e"
        master_perms = await db.execute(text("SELECT role, module, resource, action, name, is_allowed FROM role_permissions WHERE tenant_id = :tid"), {"tid": JPRS_ID})
        master_rows = master_perms.fetchall()
        
        if not master_rows:
            print("❌ Critical: JPRS Master Template empty.")
            return

        perm_data = []
        for org_id in [org_a_id, org_b_id]:
            for row in master_rows:
                perm_data.append({
                    "id": uuid.uuid4(),
                    "tenant_id": org_id,
                    "role": row.role,
                    "module": row.module,
                    "resource": row.resource,
                    "action": row.action,
                    "name": row.name,
                    "is_allowed": row.is_allowed
                })
        
        # Bulk Insert
        await db.execute(text("""
            INSERT INTO role_permissions (id, tenant_id, role, module, resource, action, name, is_allowed)
            VALUES (:id, :tenant_id, :role, :module, :resource, :action, :name, :is_allowed)
        """), perm_data)
        await db.commit()
    
    # 2. VERIFICATION LOOP
    report_lines = ["# Permission Matrix Verification Report\n"]
    report_lines.append(f"Date: {os.popen('date').read().strip() if os.name != 'nt' else 'Now'}\n")
    report_lines.append("| Role | Module | Resource:Action | Org A (Active) | Org B (Isolated) | Result |")
    report_lines.append("|---|---|---|---|---|---|")
    
    failures = []
    
    async with AsyncSessionLocal() as db:
        print("🧪 Starting Verification...")
        
        # Get unique catalog items
        distinct_perms = sorted(list(set([(r.module, r.resource, r.action) for r in master_rows])))
        roles = sorted(list(set([r.role for r in master_rows])))
        
        for role in roles:
            # Skip Super Admin as they bypass everything usually, but let's check matrix existence
            if role == 'Super Admin': continue
            
            for mod, res, act in distinct_perms:
                # SKIP specific manual overrides for performance if needed, but requested FULL check.
                
                # --- TEST CASE 1: ENABLE in ORG A ---
                # 1. Update DB for Org A -> ALLOWED = TRUE
                await db.execute(text("""
                    UPDATE role_permissions 
                    SET is_allowed = true 
                    WHERE tenant_id = :tid AND role = :role AND module = :mod AND resource = :res AND action = :act
                """), {"tid": org_a_id, "role": role, "mod": mod, "res": res, "act": act})
                
                # 2. Update DB for Org B -> ALLOWED = FALSE
                await db.execute(text("""
                    UPDATE role_permissions 
                    SET is_allowed = false
                    WHERE tenant_id = :tid AND role = :role AND module = :mod AND resource = :res AND action = :act
                """), {"tid": org_b_id, "role": role, "mod": mod, "res": res, "act": act})
                
                await db.commit()
                
                # 3. Verify
                user_a = MockUser(org_a_id, role)
                user_b = MockUser(org_b_id, role)
                
                perm_a = await verify_permission(db, user_a, mod, res, act)
                perm_b = await verify_permission(db, user_b, mod, res, act)
                
                status_a = "✅" if (perm_a and perm_a.is_allowed) else "❌"
                status_b = "✅" if (perm_b and not perm_b.is_allowed) else "❌" # Should be False
                
                final_res = "PASS"
                if status_a == "❌" or status_b == "❌":
                    final_res = "FAIL"
                    failures.append(f"{role} | {mod}:{res}:{act}")
                
                report_lines.append(f"| {role} | {mod} | {res}:{act} | {status_a} | {status_b} | {final_res} |")
                
                # Progress indicator
                print(f".", end="", flush=True)

    print("\n\n🧹 Creating Clean Up...")
    async with AsyncSessionLocal() as db:
        await db.execute(text("DELETE FROM role_permissions WHERE tenant_id IN (:tid1, :tid2)"), {"tid1": org_a_id, "tid2": org_b_id})
        await db.execute(text("DELETE FROM organizations WHERE id IN (:tid1, :tid2)"), {"tid1": org_a_id, "tid2": org_b_id})
        await db.commit()
        
    # Write Report
    with open("permission_report.md", "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
        
    if failures:
        print(f"\n❌ FOUND {len(failures)} FAILURES.")
        print(failures[:10])
    else:
        print("\n✅ ALL TESTS PASSED.")

if __name__ == "__main__":
    asyncio.run(run_verification())
