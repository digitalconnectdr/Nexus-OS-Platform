import asyncio
import os
import sys
from sqlalchemy import select
from dotenv import load_dotenv

sys.path.append(os.getcwd() + "/backend")
load_dotenv("backend/.env")

from app.core.database import SessionLocal
from app.models.core import UserProfile

async def inspect_user():
    async with SessionLocal() as db:
        # Search for Stephany
        print("=== INSPECTING USER STEPHANY ===")
        stmt = select(UserProfile).where(UserProfile.first_name.ilike('%Stephany%'))
        result = await db.execute(stmt)
        users = result.scalars().all()
        
        for u in users:
            print(f"ID: {u.id}")
            print(f"Name: {u.first_name} {u.last_name}")
            print(f"Role (Raw): '{u.role}'")
            print(f"Role (Lower): '{str(u.role).lower()}'")
            print(f"Is Representante? {str(u.role).lower() == 'representante'}")
            print(f"Is Supervisor? {'supervisor' in str(u.role).lower()}")
            print("-" * 20)

if __name__ == "__main__":
    asyncio.run(inspect_user())
