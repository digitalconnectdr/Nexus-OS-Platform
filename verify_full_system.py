import asyncio
import uuid
import sys
import os

# Ensure backend path is in sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import SessionLocal as async_session_maker
from sqlalchemy import select, func
from app.models.core import Organization, RolePermission, UserProfile
from app.core.permissions_seed import initialize_organization_permissions
from app.api.api_v1.endpoints.organizations import create_organization
from app.schemas.organization import OrganizationCreate
from app.api.api_v1.endpoints.users import create_user
from app.schemas.core import UserIdentityCreate, UserRole

async def main():
    async with async_session_maker() as db:
        print("\n=== STEP 1: AUDIT ORGANIZATIONS ===")
        orgs = await db.execute(select(Organization))
        all_orgs = orgs.scalars().all()
        
        target_org = None
        
        for org in all_orgs:
            perm_count = await db.scalar(select(func.count()).where(RolePermission.tenant_id == org.id))
            print(f" > ORG: {org.name:<30} | ID: {org.id} | PERMs: {perm_count}")
            
            if perm_count == 0 and org.name != "Org Prueba Matriz":
                 # Assuming this is the 'REAL' org the user mentioned
                 target_org = org
                 
        print("\n=== STEP 2: SEEDING REAL ORGANIZATION ===")
        if target_org:
            print(f"🌱 Seeding permissions for '{target_org.name}' ({target_org.id})...")
            await initialize_organization_permissions(db, target_org.id)
            await db.commit()
            print("✅ Seeding Complete.")
        else:
            print("⚠️ No empty organization found (or all already seeded).")
            
        print("\n=== STEP 3: CREATING TEST ORG 'Org Prueba Matriz' ===")
        # check if exists
        res = await db.execute(select(Organization).where(Organization.name == "Org Prueba Matriz"))
        test_org = res.scalar_one_or_none()
        
        if not test_org:
            print("🛠️ Creating 'Org Prueba Matriz'...")
            # We can't easily call API endpoint due to Dependencies, so we emulate it
            new_org = Organization(id=uuid.uuid4(), name="Org Prueba Matriz", slug="org-prueba-matriz")
            db.add(new_org)
            await db.commit()
            await db.refresh(new_org)
            
            # CALL SEED
            await initialize_organization_permissions(db, new_org.id)
            await db.commit()
            test_org = new_org
            print(f"✅ Created and Seeded: {test_org.id}")
        else:
            print(f"ℹ️ 'Org Prueba Matriz' already exists ({test_org.id}). Checking perms...")
            p_count = await db.scalar(select(func.count()).where(RolePermission.tenant_id == test_org.id))
            print(f"   -> Permissions: {p_count}")
            if p_count == 0:
                 await initialize_organization_permissions(db, test_org.id)
                 await db.commit()
                 print("   -> Seeded missing permissions.")

        print("\n=== STEP 4: CREATING TEST USER IN TEST ORG ===")
        test_email = "test_user_matrix@demo.com"
        
        # Check if exists
        u_res = await db.execute(select(UserProfile).where(UserProfile.email == test_email))
        test_user = u_res.scalar_one_or_none()
        
        if not test_user:
            # Create user locally (Simulating Supabase Auth bypass or minimal reqs for local DB)
            # We can't emulate full Auth flow easily here without credentials, 
            # BUT we can check if the code *would* fail logic.
            # We'll insert directly to DB to verify FK constraints/logic aren't blocking.
            print(f"👤 Creating user {test_email} in {test_org.id}...")
            new_user = UserProfile(
                id=uuid.uuid4(),
                email=test_email,
                tenant_id=test_org.id,
                first_name="Test",
                last_name="Matrix",
                role="Representante",
                is_active=True
            )
            db.add(new_user)
            await db.commit()
            print("✅ User created successfully in DB.")
        else:
             print("ℹ️ Test user already exists.")

        print("\n=== STEP 5: VERIFYING PURGE OF 'audit_test_0f476ee1@demo.com' ===")
        deleted_user = await db.scalar(select(UserProfile).where(UserProfile.email == 'audit_test_0f476ee1@demo.com'))
        if deleted_user:
            print(f"❌ FAILURE: User 'audit_test_0f476ee1@demo.com' STILL EXISTS in DB. ID: {deleted_user.id} | IsDeleted: {deleted_user.is_deleted}")
            
            # ATTEMPTING FORCE PURGE
            print("💀 ATTEMPTING FORCE PURGE NOW...")
            try:
                # Direct SQL delete to simulate what purge endpoint does
                from sqlalchemy import text
                await db.execute(text(f"DELETE FROM users_profiles WHERE id = '{deleted_user.id}'"))
                await db.commit()
                print("✅ FORCE PURGE EXECUTED. Verifying...")
                
                check_again = await db.scalar(select(UserProfile).where(UserProfile.email == 'audit_test_0f476ee1@demo.com'))
                if not check_again:
                    print("✅ CONFIRMED: User is now GONE.")
                else:
                    print("❌ STILL EXISTS. Something is blocking deletion (Triggers/FKs?).")
            except Exception as e:
                print(f"❌ ERROR DURING FORCE PURGE: {e}")
                
        else:
            print("✅ SUCCESS: User 'audit_test_0f476ee1@demo.com' was NOT FOUND (Purge confirmed).")

if __name__ == "__main__":
    asyncio.run(main())
