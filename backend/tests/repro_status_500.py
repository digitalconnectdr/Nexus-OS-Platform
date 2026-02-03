import asyncio
import uuid
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres")

async def run_test():
    # Deferred imports to avoid path issues
    import sys
    sys.path.append(os.path.join(os.getcwd(), "backend"))
    from app.models.status import Status
    from app.api.api_v1.endpoints.sales import to_uuid

    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        try:
            # 1. Get any status ID
            status_res = await db.execute(select(Status).limit(1))
            status = status_res.scalar_one_or_none()
            if not status:
                print("No status found in DB to test.")
                return
            
            status_id_str = str(status.id)
            print(f"Testing with Status ID (string): {status_id_str}")
            
            # 2. Test the fix
            print("Applying to_uuid()...")
            mapped_id = to_uuid(status_id_str)
            print(f"Mapped ID type: {type(mapped_id)}")
            
            print("Executing query...")
            s_query = select(Status).where(Status.id == mapped_id)
            s_res = await db.execute(s_query)
            status_obj = s_res.scalar_one_or_none()
            
            if status_obj:
                print(f"SUCCESS: Found status '{status_obj.name}' using string ID + to_uuid()")
            else:
                print("FAILURE: Status not found even with mapping.")

        except Exception as e:
            print(f"ERROR DURING TEST: {type(e).__name__}: {e}")
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_test())
