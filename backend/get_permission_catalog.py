
import asyncio
import os
import asyncpg
from dotenv import load_dotenv
import json

base_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(base_dir, '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

async def get_catalog():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        # Get all unique permission definitions
        rows = await conn.fetch("""
            SELECT DISTINCT module, resource, action, name
            FROM role_permissions
            ORDER BY module, resource, action
        """)
        
        roles = await conn.fetch("SELECT DISTINCT role FROM role_permissions ORDER BY role")
        
        catalog = [dict(r) for r in rows]
        role_list = [r['role'] for r in roles]
        
        print(json.dumps({"catalog": catalog, "roles": role_list}, indent=2))
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(get_catalog())
