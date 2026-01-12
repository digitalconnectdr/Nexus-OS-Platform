
import asyncio
import sys
import os
from dotenv import load_dotenv

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Load environment variables from backend/.env
load_dotenv(os.path.join(os.getcwd(), "backend", ".env"))

from app.core.database import SessionLocal
from app.models import SalesOrder
from sqlalchemy import select, func

async def check_statuses():
    async with SessionLocal() as session:
        stmt = select(SalesOrder.status, func.count(SalesOrder.id)).group_by(SalesOrder.status)
        res = await session.execute(stmt)
        print("SalesOrder Status Counts:")
        for row in res.all():
            print(f"  Status: {row.status}, Count: {row[1]}")

if __name__ == "__main__":
    asyncio.run(check_statuses())
