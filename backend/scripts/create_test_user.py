import asyncio
from supabase import create_client, Client
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.core import UserProfile, Organization
from sqlalchemy import select
import uuid

# Supabase Admin usage
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

async def create_test_user():
    email = "test_supervisor@example.com"
    password = "password123"
    role = "Supervisor"
    first_name = "Test"
    last_name = "Supervisor"

    print(f"Provisioning Test User: {email}...")

    supabase_id = None
    # 1. Create in Supabase Auth
    try:
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True
        })
        if res.user:
            supabase_id = res.user.id
            print(f"Supabase Auth User created: {supabase_id}")
    except Exception as e:
        emsg = str(e)
        if "already registered" in emsg.lower() or "already exists" in emsg.lower():
            print("User exists in Auth. Fetching ID...")
            users_res = supabase.auth.admin.list_users()
            # Depending on version, it might be a list or an object
            users = users_res if isinstance(users_res, list) else getattr(users_res, 'users', [])
            user = next((u for u in users if u.email == email), None)
            if user:
                supabase_id = user.id
                print(f"Found existing Auth ID: {supabase_id}")
            else:
                print("Could not find user in list even though it reported exists.")
                return
        else:
            print(f"Error creating user: {e}")
            return

    if not supabase_id:
        print("Failed to obtain Supabase ID")
        return

    # 2. Assign to Organization and Local DB
    async with SessionLocal() as db:
        # Get demo org
        res = await db.execute(select(Organization).where(Organization.slug == "demo-company"))
        org = res.scalar_one_or_none()
        if not org:
            print("Org 'demo-company' not found. Ensure it exists.")
            return

        # Check if profile exists
        res = await db.execute(select(UserProfile).where(UserProfile.email == email))
        profile = res.scalar_one_or_none()

        if profile:
            # We cannot easily update PK if it changes, but if it exists we check ID
            if str(profile.id) != supabase_id:
                print(f"ID mismatch for {email}. Recreating profile...")
                await db.delete(profile)
                await db.flush()
                profile = None

        if not profile:
            # Create
            new_profile = UserProfile(
                id=uuid.UUID(supabase_id),
                email=email,
                role=role,
                first_name=first_name,
                last_name=last_name,
                tenant_id=org.id,
                is_active=True
            )
            db.add(new_profile)
            print(f"Created new profile: {email}")
        else:
            # Update
            profile.role = role
            profile.first_name = first_name
            profile.last_name = last_name
            profile.tenant_id = org.id
            print(f"Updated existing profile: {email}")
        
        await db.commit()
    
    print(f"Done! Test User ready. Email: {email}, Pass: {password}")

if __name__ == "__main__":
    asyncio.run(create_test_user())
