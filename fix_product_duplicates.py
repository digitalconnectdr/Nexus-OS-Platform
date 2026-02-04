
import asyncio
import os
import sys

# Add backend to sys.path
current_dir = os.getcwd()
backend_dir = os.path.join(current_dir, "backend")
sys.path.append(backend_dir)

from sqlalchemy import select, delete
from app.core.database import SessionLocal
from app.models.core import Product

async def fix_duplicates():
    async with SessionLocal() as db:
        print("Checking for 'CLARO VIDEO' duplicates to clean up...")
        stmt = select(Product).where(Product.name.ilike('%CLARO VIDEO%')).order_by(Product.id) # ordering by ID to keep somewhat deterministic
        result = await db.execute(stmt)
        products = result.scalars().all()
        
        if len(products) <= 1:
            print(f"Only {len(products)} found. No action needed.")
            return

        print(f"Found {len(products)} duplicates. Keeping the last one (most recent usually, or just one).")
        
        # Keep the LAST one in the list (assuming UUIDs are random, it doesn't matter much which one we keep, but let's keep one)
        # Actually logic: if content is identical, keep any.
        keep_product = products[-1]
        delete_products = products[:-1]
        
        delete_ids = [p.id for p in delete_products]
        
        print(f"Keeping ID: {keep_product.id}")
        print(f"Deleting IDs: {delete_ids}")
        
        del_stmt = delete(Product).where(Product.id.in_(delete_ids))
        await db.execute(del_stmt)
        await db.commit()
        
        print("Cleanup complete.")

if __name__ == "__main__":
    asyncio.run(fix_duplicates())
