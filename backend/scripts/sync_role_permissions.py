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

    print("🔄 Starting Total Permission Synchronization...")
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    
    try:
        async with conn.transaction():
            # 1. Get all organizations
            orgs = await conn.fetch("SELECT id FROM organizations;")
            
            # 2. Get existing permissions to avoid duplicates
            existing = await conn.fetch("SELECT tenant_id, role, resource, action FROM role_permissions;")
            existing_keys = set((str(r['tenant_id']), r['role'], r['resource'], r['action']) for r in existing)
            
            new_records = []
            
            for org in orgs:
                org_id = str(org['id'])
                for role in ROLES:
                    for mod, res, act, label in MASTER_CATALOG:
                        key = (org_id, role, res, act)
                        if key not in existing_keys:
                            # Missing entry detected
                            new_records.append((
                                str(uuid.uuid4()),
                                org['id'], # UUID type
                                role,
                                mod,
                                res,
                                act,
                                label,
                                False # Default to False as requested
                            ))
            
            if new_records:
                print(f"📦 Filling {len(new_records)} gaps in role_permissions matrix...")
                await conn.executemany("""
                    INSERT INTO role_permissions (id, tenant_id, role, module, resource, action, name, is_allowed)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
                """, new_records)
            else:
                print("✅ No gaps found. Matrix is already synchronized.")
                
        print("✨ Synchronization complete.")
    except Exception as e:
        print(f"❌ Error during sync: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(sync())
