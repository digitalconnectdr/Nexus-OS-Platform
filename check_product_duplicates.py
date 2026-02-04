
import asyncio
import os
import sys

# Add backend to sys.path
current_dir = os.getcwd()
backend_dir = os.path.join(current_dir, "backend")
sys.path.append(backend_dir)

from sqlalchemy import select, func
from app.core.database import SessionLocal
from app.models.core import Product

async def check_duplicates():
    async with SessionLocal() as db:
        print("Checking for products with name 'CLARO VIDEO' or similar...")
        stmt = select(Product).where(Product.name.ilike('%CLARO VIDEO%'))
        result = await db.execute(stmt)
        products = result.scalars().all()
        
        print(f"Found {len(products)} products matching 'CLARO VIDEO':")
        for p in products:
            print(f"ID: {p.id} | Name: {p.name} | Campaign: {p.campaign_id}")

        # Check for exact duplicates (same name, same campaign, same everything except ID)
        if len(products) > 1:
            print("\nAnalyzing for exact content duplicates...")
            first = products[0]
            duplicates = 0
            for other in products[1:]:
                if (first.name == other.name and 
                    first.campaign_id == other.campaign_id and 
                    first.family_name == other.family_name and
                    first.plan_name == other.plan_name):
                    duplicates += 1
            
            if duplicates > 0:
                print(f"Found {duplicates} potential content duplicates of the first item.")
                
if __name__ == "__main__":
    asyncio.run(check_duplicates())
