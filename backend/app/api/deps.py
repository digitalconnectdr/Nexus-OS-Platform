from typing import AsyncGenerator
from app.core.database import SessionLocal
from sqlalchemy import text

async def get_db() -> AsyncGenerator:
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            # Explicitly close to ensure the connection is returned to the pool
            await session.close()

async def verify_db_connection(db):
    try:
        await db.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"DB connection error: {e}")
        return False
