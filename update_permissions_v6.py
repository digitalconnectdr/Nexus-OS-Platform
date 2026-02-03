
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os

DATABASE_URL = "postgresql+asyncpg://postgres.hjjhqguwhcqtaxdhbdsx:Jc081203NexusAdmin2026@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

async def update_permissions():
    # 🛑 Fix for PgBouncer: statement_cache_size=0
    engine = create_async_engine(DATABASE_URL, connect_args={"statement_cache_size": 0})
    
    updates = [
        ("tournaments", "view_module", "Ver Pestaña de Torneos"),
        ("tournaments", "create_battle", "Crear Nueva Batalla"),
        ("tournaments", "edit", "Editar Competencias"),
        ("tournaments", "delete", "Eliminar Competencias"),
        ("tournaments", "view_race_track", "Ver Pista de Carreras"),
        ("tournaments", "arbitration_panel", "Botón de Arbitraje")
    ]
    
    async with engine.begin() as conn:
        for resource, action, name in updates:
            print(f"Updating {resource}:{action} -> {name}")
            await conn.execute(
                text("UPDATE role_permissions SET name = :name WHERE resource = :resource AND action = :action"),
                {"name": name, "resource": resource, "action": action}
            )
            
    await engine.dispose()
    print("Permissions labels updated successfully!")

if __name__ == "__main__":
    asyncio.run(update_permissions())
