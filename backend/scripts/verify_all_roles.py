import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')
db_url = os.getenv('DATABASE_URL').replace('postgresql+asyncpg://', 'postgresql://')

async def verify():
    conn = await asyncpg.connect(db_url)
    try:
        # Get count per role across all tenants
        roles_report = await conn.fetch("""
            SELECT role, tenant_id, count(*) 
            FROM role_permissions 
            GROUP BY role, tenant_id 
            ORDER BY role, tenant_id;
        """)
        
        print("| Role | Tenant ID (Partial) | Permission Count |")
        print("|------|-------------------|------------------|")
        for r in roles_report:
            print(f"| {r['role']:18} | {str(r['tenant_id'])[:13]}... | {r['count']} |")
            
        # Overall sanity check
        invalid = await conn.fetchval("SELECT count(*) FROM (SELECT role, tenant_id, count(*) FROM role_permissions GROUP BY role, tenant_id HAVING count(*) != 99) as sub;")
        if invalid == 0:
            print("\n✅ SUCCESS: Every single active Role/Tenant combination has exactly 99 permissions.")
        else:
            print(f"\n❌ FAILURE: Found {invalid} combinations that do not have 99 permissions.")
            
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(verify())
