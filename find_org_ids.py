import asyncio
from sqlalchemy import text

async def find_orgs():
    # Import here to allow sys.path to work
    from app.core.database import SessionLocal
    
    async with SessionLocal() as db:
        print("Searching for organizations...")
        
        # Search for b23097fd...
        result_1 = await db.execute(text("SELECT id, name, slug FROM organizations WHERE id::text LIKE 'b23097fd%'"))
        org_1 = result_1.fetchall()
        print(f"\nMatches for 'b23097fd...': {org_1}")

        # Search for fe0192a0...
        result_2 = await db.execute(text("SELECT id, name, slug FROM organizations WHERE id::text LIKE 'fe0192a0%'"))
        org_2 = result_2.fetchall()
        print(f"\nMatches for 'fe0192a0...': {org_2}")

if __name__ == "__main__":
    import sys
    import os
    # Add backend to path explicitly
    current_dir = os.getcwd()
    backend_path = os.path.join(current_dir, "backend")
    sys.path.insert(0, backend_path)
    print(f"Added to path: {backend_path}")
    
    from dotenv import load_dotenv
    load_dotenv(os.path.join(backend_path, ".env"))
    
    asyncio.run(find_orgs())
