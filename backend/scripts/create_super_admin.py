import asyncio
import os
import uuid
from supabase import create_client, Client
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from dotenv import load_dotenv

# Load env from backend
load_dotenv()

from app.models.core import UserProfile, Organization
from app.core.config import settings

async def create_super_admin():
    # 1. Initialize Supabase Admin Client
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_KEY
    supabase: Client = create_client(url, key)

    # 2. Data
    email = "jcpenalo@gmail.com"
    password = "jc081203"
    first_name = "Juan C"
    last_name = "Penalo"
    role = "Super Admin"

    print(f"--- Iniciando creación de Super Admin: {email} ---")

    # 3. Create User in Supabase Auth (via Admin API)
    try:
        # Check if user already exists in Auth
        auth_users = supabase.auth.admin.list_users()
        existing_auth_user = next((u for u in auth_users if u.email == email), None)
        
        if existing_auth_user:
            print(f"Usuario ya existe en Supabase Auth ID: {existing_auth_user.id}")
            auth_user_id = existing_auth_user.id
        else:
            print("Creando usuario en Supabase Auth...")
            res = supabase.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"first_name": first_name, "last_name": last_name}
            })
            auth_user_id = res.user.id
            print(f"Usuario creado exitosamente. ID: {auth_user_id}")
    except Exception as e:
        print(f"Error en Supabase Auth: {str(e)}")
        return

    # 4. Initialize Database
    engine = create_async_engine(settings.DATABASE_URL)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # 5. Check/Create Organization
        result = await db.execute(select(Organization).where(Organization.slug == "default"))
        org = result.scalar_one_or_none()
        
        if not org:
            print("Creando Organización por defecto...")
            org = Organization(name="Default Organization", slug="default")
            db.add(org)
            await db.flush()
        
        # 6. Check/Create User Profile
        result = await db.execute(select(UserProfile).where(UserProfile.email == email))
        profile = result.scalar_one_or_none()
        
        if profile:
            print("Actualizando perfil existente...")
            profile.role = role
            profile.first_name = first_name
            profile.last_name = last_name
            profile.is_active = True
            profile.is_deleted = False
        else:
            print("Creando nuevo perfil de usuario...")
            profile = UserProfile(
                id=uuid.UUID(auth_user_id),
                tenant_id=org.id,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=role,
                is_active=True
            )
            db.add(profile)
        
        await db.commit()
        print("--- Operación completada con éxito ---")

if __name__ == "__main__":
    asyncio.run(create_super_admin())
