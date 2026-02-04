
import asyncio
import os
import sys

# Add backend to sys.path
current_dir = os.getcwd()
backend_dir = os.path.join(current_dir, "backend")
sys.path.append(backend_dir)

from sqlalchemy import text
from app.core.database import SessionLocal

async def add_constraint():
    async with SessionLocal() as db:
        print("Adding unique constraint to products table...")
        # Constraint: unique(tenant_id, campaign_id, name)
        # We need to make sure the name is unique within the campaign and tenant.
        # However, checking if constraint already exists is good practice or just try/except.
        
        sql = """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'products_tenant_campaign_name_key'
            ) THEN
                ALTER TABLE products
                ADD CONSTRAINT products_tenant_campaign_name_key UNIQUE (tenant_id, campaign_id, name);
                RAISE NOTICE 'Constraint added';
            ELSE
                RAISE NOTICE 'Constraint already exists';
            END IF;
        END $$;
        """
        
        try:
            await db.execute(text(sql))
            await db.commit()
            print("Constraint check/creation executed successfully.")
        except Exception as e:
            await db.rollback()
            print(f"Error adding constraint: {e}")

if __name__ == "__main__":
    asyncio.run(add_constraint())
