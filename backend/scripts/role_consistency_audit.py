import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.getcwd(), ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

async def run_audit():
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found.")
        return 

    print("--- Role Consistency Audit Report ---")
    conn = await asyncpg.connect(DATABASE_URL, statement_cache_size=0)
    
    try:
        # 1. Policies Table Audit
        print("\n[1] Role Policies Table Audit:")
        roles = await conn.fetch("SELECT DISTINCT role FROM role_policies")
        if roles:
            for r in roles:
                print(f"    - Role in DB: '{r['role']}'")
        else:
            print("    - No policies found in table 'role_policies'.")

        # 2. Users Table Audit (Extra context)
        print("\n[2] Users Profiles Table Audit:")
        user_roles = await conn.fetch("SELECT DISTINCT role FROM users_profiles")
        for ur in user_roles:
            print(f"    - User Role in DB: '{ur['role']}'")

    except Exception as e:
        print(f"❌ Error during audit: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run_audit())
