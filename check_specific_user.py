import asyncio
import os
import sys
from sqlalchemy import select
from dotenv import load_dotenv

# Add current dir to sys.path
sys.path.append(os.getcwd() + "/backend")

# Load environment variables
load_dotenv("backend/.env")

from app.core.database import SessionLocal
from app.models.core import UserProfile

async def check_user():
    async with SessionLocal() as db:
        email = "jcpenalo@digitalconnectdr.com"
        print(f"=== CHECKING USER: {email} ===")
        
        stmt = select(UserProfile).where(UserProfile.email == email)
        result = await db.execute(stmt)
        user = result.scalars().first()
        
        if user:
            print(f"ID: {user.id}")
            print(f"Role: '{user.role}'")
            print(f"Is Active: {user.is_active}")
            print(f"Is Deleted: {user.is_deleted}")
            print(f"Tenant ID: {user.tenant_id}")
            
            # Check for hex codes or hidden chars in role
            print(f"Role Bytes: {user.role.encode('utf-8')}")
        else:
            print("User not found.")

if __name__ == "__main__":
    asyncio.run(check_user())
