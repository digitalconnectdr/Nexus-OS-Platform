import asyncio
from sqlalchemy import select, delete
from app.core.database import SessionLocal
from app.models.core import UserProfile

async def fix_user_id():
    supabase_id = "60860676-a91d-4d02-a4c2-3502971a6e78"
    email = "jcpenalo@gmail.com"
    
    async with SessionLocal() as db:
        # 1. Find the old profile
        res = await db.execute(select(UserProfile).where(UserProfile.email == email))
        old_profile = res.scalar_one_or_none()
        
        if old_profile:
            if str(old_profile.id) == supabase_id:
                print("ID already matches. No action needed.")
                return
            
            print(f"Fixing ID for {email}: {old_profile.id} -> {supabase_id}")
            
            # We can't easily update PK in some DBs, so we'll delete and recreate 
            # (assuming no critical FKs yet for this user)
            
            # Copy data
            data = {
                "tenant_id": old_profile.tenant_id,
                "role": old_profile.role,
                "first_name": old_profile.first_name,
                "last_name": old_profile.last_name,
                "email": old_profile.email,
                "is_active": True,
                "is_deleted": False
            }
            
            await db.delete(old_profile)
            await db.flush()
            
            new_profile = UserProfile(id=supabase_id, **data)
            db.add(new_profile)
            await db.commit()
            print("User profile ID synchronized successfully.")
        else:
            print("User not found in DB. Run creation script instead.")

if __name__ == "__main__":
    asyncio.run(fix_user_id())
