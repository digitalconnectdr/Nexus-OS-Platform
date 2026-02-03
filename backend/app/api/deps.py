from typing import AsyncGenerator
from app.core.database import SessionLocal
from sqlalchemy import text

from fastapi import HTTPException, status

TENANT_ID_FIX = None # Dejar que el middleware o auth lo resuelvan

async def set_session_tenant(session, tenant_id: str):
    """Auxiliary to set the tenant in the Postgres session config"""
    if tenant_id:
        try:
            await session.execute(text(f"SELECT set_config('app.current_tenant', '{tenant_id}', false);"))
        except Exception as e:
            # Capturar error de configuración si el tenant no existe en DB local
            print(f"Error setting session tenant {tenant_id}: {e}")

async def get_db() -> AsyncGenerator:
    """
    Resilient DB session provider.
    Rely on SQLAlchemy pool_pre_ping for health checks.
    """
    session = SessionLocal()
    try:
        yield session
    finally:
        await session.close()

async def verify_db_connection(db):
    try:
        await db.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"DB connection error: {e}")
        return False
