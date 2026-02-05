
import asyncio
import logging
from sqlalchemy import select
from app.core.database import SessionLocal as async_session_factory
from app.models.core import Organization

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def list_orgs():
    async with async_session_factory() as db:
        print("Listing Organizations...")
        result = await db.execute(select(Organization))
        orgs = result.scalars().all()
        
        for org in orgs:
            print(f"ORG: {org.name} | ID: {org.id}")

if __name__ == "__main__":
    asyncio.run(list_orgs())
