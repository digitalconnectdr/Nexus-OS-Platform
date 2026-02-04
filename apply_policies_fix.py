import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import SessionLocal
from sqlalchemy import text

async def main():
    async with SessionLocal() as db:
        print("🛡️ Applying RLS Policy Fixes...")
        with open('backend/migrations/fix_rls_policies.sql', 'r') as f:
            sql = f.read()
        
        # Split statements manually if needed or execute block
        # Supabase postgres usually accepts blocks via text()
        try:
            await db.execute(text(sql))
            await db.commit()
            print("✅ Policies Applied Successfully.")
        except Exception as e:
            print(f"❌ Error applying policies: {e}")

if __name__ == "__main__":
    asyncio.run(main())
