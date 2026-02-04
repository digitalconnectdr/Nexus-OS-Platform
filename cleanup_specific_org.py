import asyncio
import sys
import os
from sqlalchemy import select, delete, text

# Setup path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import SessionLocal
from app.models.core import Organization, RolePermission, UserProfile, SalesOrder, Product, Campaign, RolePolicy
from app.models.tournament import Tournament
from app.models.sales_goal import SalesGoal
from app.models.status import Status

TARGET_NAME = "DOFU CARIBBEAN GROUP SRL 16"

async def delete_target_org():
    async with SessionLocal() as db:
        print(f"🔍 Searching for organization: '{TARGET_NAME}'...")
        
        # 1. Find Org
        stmt = select(Organization).where(Organization.name == TARGET_NAME)
        result = await db.execute(stmt)
        org = result.scalar_one_or_none()
        
        if not org:
            print("❌ Organization not found.")
            return

        print(f"✅ Found Org: {org.name} (ID: {org.id})")
        
        try:
            # 2. Deletion Order (Child to Parent)
            
            # --- operational data ---
            print(f"   > Deleting SalesOrders for {org.id}...")
            await db.execute(delete(SalesOrder).where(SalesOrder.tenant_id == org.id))
            
            # CRITICAL: Unlink users from cross-tenant SalesOrders
            print(f"   > Unlinking cross-tenant User references...")
            # Get list of user IDs in this org
            user_ids_result = await db.execute(select(UserProfile.id).where(UserProfile.tenant_id == org.id))
            user_ids = user_ids_result.scalars().all()
            
            if user_ids:
                from sqlalchemy import update
                print(f"   > Found {len(user_ids)} users. Nullifying external references...")
                # Nullify digitizer_id
                await db.execute(
                    update(SalesOrder)
                    .where(SalesOrder.digitizer_id.in_(user_ids))
                    .values(digitizer_id=None)
                )
                # Nullify agent_id
                await db.execute(
                    update(SalesOrder)
                    .where(SalesOrder.agent_id.in_(user_ids))
                    .values(agent_id=None)
                )
                # Nullify supervisor_id
                await db.execute(
                    update(SalesOrder)
                    .where(SalesOrder.supervisor_id.in_(user_ids))
                    .values(supervisor_id=None)
                )
            
            print(f"   > Deleting SalesGoals for {org.id}...")
            await db.execute(delete(SalesGoal).where(SalesGoal.tenant_id == org.id))
            
            print(f"   > Deleting Tournaments for {org.id}...")
            # Note: Participations should cascade from Tournament or UserProfile
            await db.execute(delete(Tournament).where(Tournament.tenant_id == org.id))

            # --- config data ---
            print(f"   > Deleting Products for {org.id}...")
            await db.execute(delete(Product).where(Product.tenant_id == org.id))

            print(f"   > Deleting Campaigns for {org.id}...")
            await db.execute(delete(Campaign).where(Campaign.tenant_id == org.id))

            print(f"   > Deleting Statuses for {org.id}...")
            await db.execute(delete(Status).where(Status.tenant_id == org.id))

            # --- security/users ---
            print(f"   > Deleting RolePermissions for {org.id}...")
            await db.execute(delete(RolePermission).where(RolePermission.tenant_id == org.id))

            print(f"   > Deleting RolePolicies for {org.id}...")
            await db.execute(delete(RolePolicy).where(RolePolicy.tenant_id == org.id))
            
            print(f"   > Unlinking/Deleting users for {org.id}...")
            await db.execute(delete(UserProfile).where(UserProfile.tenant_id == org.id))
            
            # 3. Delete Org
            print(f"   > Deleting Organization {org.id}...")
            await db.execute(delete(Organization).where(Organization.id == org.id))
            
            await db.commit()
            print("🚀 DELETION SUCCESSFUL.")

            
        except Exception as e:
            print(f"❌ Error during deletion: {e}")
            await db.rollback()

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(delete_target_org())
