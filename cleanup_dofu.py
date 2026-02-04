import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import SessionLocal
from sqlalchemy import text

async def main():
    async with SessionLocal() as db:
        print("🧹 Cleaning up 'DOFU' organizations...")
        try:
            # Delete all DOFU*
            await db.execute(text("DELETE FROM organizations WHERE name LIKE '%DOFU%'"))
            await db.commit()
            print("✅ All 'DOFU' organizations purged.")
        except Exception as e:
            # If cascade fails (shouldn't, I fixed it), try force
            print(f"⚠️ Standard delete failed: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(main())
