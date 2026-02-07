import asyncio
import asyncpg
import os
import uuid
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.getcwd(), ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

from app.core.permissions_catalog import ROLES, MASTER_CATALOG

async def sync():
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found.")
        return 

    print("🔄 [ULTRA-VIOLENT SYNC] Starting Total Permission Reconstruction...")
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    
    try:
        async with conn.transaction():
            # 0. ADJUST DB CONSTRAINTS
            print("🔧 Adjusting database constraints to include 'module'...")
            await conn.execute("ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS _role_resource_action_tenant_uc;")
            # Use ON CONFLICT or just ADD. Since we purge later, we just need the new constraint.
            await conn.execute("""
                ALTER TABLE role_permissions 
                DROP CONSTRAINT IF EXISTS _role_module_resource_action_tenant_uc;
            """)
            await conn.execute("""
                ALTER TABLE role_permissions 
                ADD CONSTRAINT _role_module_resource_action_tenant_uc 
                UNIQUE (role, module, resource, action, tenant_id);
            """)

            # 1. Capture existing 'is_allowed' states to preserve manual overrides
            print("📸 Backing up current 'is_allowed' states...")
            existing_states = await conn.fetch("SELECT tenant_id, role, resource, action, is_allowed FROM role_permissions;")
            state_map = {} # (tenant_id, role, resource, action) -> is_allowed
            for r in existing_states:
                key = (str(r['tenant_id']), r['role'].lower(), r['resource'].lower(), r['action'].lower())
                state_map[key] = r['is_allowed']
            
            # 2. DELETE ALL existing permissions
            print("🧨 CRITICAL: Purging all existing records in role_permissions...")
            await conn.execute("DELETE FROM role_permissions;")
            
            # 3. RECONSTRUCT from MASTER_CATALOG
            orgs = await conn.fetch("SELECT id FROM organizations WHERE is_deleted = false;")
            print(f"🏢 Reconstructing for {len(orgs)} organizations and {len(ROLES)} roles.")
            
            new_records = []
            for org in orgs:
                org_id = str(org['id'])
                for role in ROLES:
                    role_norm = role.lower()
                    for mod, res, act, label in MASTER_CATALOG:
                        # Check if we should preserve state
                        state_key = (org_id, role_norm, res.lower(), act.lower())
                        is_allowed = state_map.get(state_key, False)
                        
                        new_records.append((
                            str(uuid.uuid4()),
                            org['id'],
                            role_norm,
                            mod,
                            res,
                            act,
                            label,
                            is_allowed
                        ))
            
            if new_records:
                print(f"🚀 Inserting {len(new_records)} fresh, standardized records ({len(MASTER_CATALOG)} per role/org)...")
                # Using batch insert for speed
                await conn.executemany("""
                    INSERT INTO role_permissions (id, tenant_id, role, module, resource, action, name, is_allowed)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
                """, new_records)

        print("✨ [ULTRA-VIOLENT SYNC] Success. System is now perfectly standardized.")
        
        # FINAL VERIFICATION
        final_counts = await conn.fetch("""
            SELECT role, tenant_id, count(*) 
            FROM role_permissions 
            GROUP BY role, tenant_id;
        """)
        print("📊 Verification Matrix:")
        for row in final_counts:
            print(f" - Role: {row['role'] or 'N/A':15} | Org: {str(row['tenant_id'])[:8]}... | Count: {row['count']}")
            if row['count'] != 99:
                print(f"   ⚠️ WARNING: Count mismatch for {row['role']}! Expected 99, got {row['count']}")

    except Exception as e:
        print(f"❌ Error during ultra-violent sync: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(sync())
