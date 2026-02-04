import asyncio
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))

from app.core.database import SessionLocal
from sqlalchemy import text

async def main():
    async with SessionLocal() as db:
        print("🛠️ Applying Cascade Constraints...")
        
        # 1. Sales Orders -> Agent (User)
        # Drop existing constraint
        try:
            print("   > Dropping sales_orders_agent_id_fkey...")
            await db.execute(text("ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_agent_id_fkey"))
            
            print("   > Re-creating sales_orders_agent_id_fkey with ON DELETE CASCADE (Ref: users_profiles)...")
            await db.execute(text("ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES users_profiles(id) ON DELETE CASCADE"))
        except Exception as e:
            print(f"   ❌ Error on Agent FK: {e}")

        # 2. Sales Orders -> Organization (Tenant)
        # Check if constraint exists, name might vary, usually sales_orders_tenant_id_fkey
        try:
            print("   > Dropping sales_orders_tenant_id_fkey...")
            await db.execute(text("ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_tenant_id_fkey"))
            
            print("   > Re-creating sales_orders_tenant_id_fkey with ON DELETE CASCADE (Ref: organizations)...")
            await db.execute(text("ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE"))
        except Exception as e:
             print(f"   ❌ Error on Tenant FK: {e}")
             
        # 3. User Profile -> Organization
        try:
            print("   > Dropping users_profiles_tenant_id_fkey...")
            await db.execute(text("ALTER TABLE users_profiles DROP CONSTRAINT IF EXISTS users_profiles_tenant_id_fkey"))
            
            print("   > Re-creating users_profiles_tenant_id_fkey with ON DELETE CASCADE (Ref: organizations)...")
            await db.execute(text("ALTER TABLE users_profiles ADD CONSTRAINT users_profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES organizations(id) ON DELETE CASCADE"))
        except Exception as e:
             print(f"   ❌ Error on User-Org FK: {e}")

        await db.commit()
        print("✅ Constraints Updated. Purges should now cascade.")

if __name__ == "__main__":
    asyncio.run(main())
