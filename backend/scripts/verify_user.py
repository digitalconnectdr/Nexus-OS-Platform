import asyncio
from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.core import UserProfile

async def check():
    async with SessionLocal() as db:
        res = await db.execute(select(UserProfile).where(UserProfile.email == 'jcpenalo@gmail.com'))
        u = res.scalar_one_or_none()
        if u:
            print(f"FOUND_DB_ID: {u.id}")
            print(f"FOUND_DB_EMAIL: {u.email}")
            print(f"FOUND_DB_ACTIVE: {u.is_active}")
        else:
            print("USER_NOT_FOUND_IN_DB")
        
        # Check all users
        res_all = await db.execute(select(UserProfile))
        users = res_all.scalars().all()
        print(f"TOTAL_USERS: {len(users)}")
        for user in users:
            print(f"USER: {user.id} | {user.email} | {user.role} | {user.tenant_id}")

if __name__ == "__main__":
    asyncio.run(check())
