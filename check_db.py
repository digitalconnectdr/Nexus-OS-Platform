import sys
import os
import asyncio
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import select, func

# Configurar el path para encontrar el módulo app
sys.path.append(os.path.join(os.getcwd(), "backend"))

# Cargar variables de entorno explícitamente desde backend/.env
load_dotenv(os.path.join(os.getcwd(), "backend", ".env"))

from app.core.database import SessionLocal
from app.models import SalesOrder, SalesGoal, Campaign, Product

async def check_data():
    async with SessionLocal() as db:
        # Mes a consultar
        target_month = "2026-01"
        
        # 1. Cantidad de Campañas y Productos
        campaigns = await db.execute(select(func.count(Campaign.id)))
        products = await db.execute(select(func.count(Product.id)))
        print(f"Campañas: {campaigns.scalar()}")
        print(f"Productos: {products.scalar()}")

        # 2. Metas para 2026-01
        goals = await db.execute(select(func.count(SalesGoal.id)).where(SalesGoal.month == target_month))
        print(f"Metas para {target_month}: {goals.scalar()}")
        
        # Ver una muestra de metas
        sample_goals = await db.execute(select(SalesGoal).where(SalesGoal.month == target_month).limit(5))
        print("\nMuestra de Metas:")
        for g in sample_goals.scalars().all():
            print(f"  - Campaign: {g.campaign_id}, Product: {g.product_id}, Target: {g.target_amount}")

        # 3. Ventas para 2026-01
        sales = await db.execute(select(func.count(SalesOrder.id)).where(
            func.to_char(SalesOrder.created_at, 'YYYY-MM') == target_month
        ))
        print(f"\nVentas totales para {target_month}: {sales.scalar()}")

        # 4. Ver distribución de estados de ventas para 2026-01
        status_stmt = select(SalesOrder.status, func.count(SalesOrder.id)).where(
            func.to_char(SalesOrder.created_at, 'YYYY-MM') == target_month
        ).group_by(SalesOrder.status)
        status_res = await db.execute(status_stmt)
        print("\nDistribución de estados para 2026-01:")
        for status, count in status_res.all():
            print(f"  - {status}: {count}")

        # 5. Ver una muestra de ventas
        sample_sales = await db.execute(select(SalesOrder).where(
            func.to_char(SalesOrder.created_at, 'YYYY-MM') == target_month
        ).limit(5))
        print("\nMuestra de Ventas:")
        for s in sample_sales.scalars().all():
            print(f"  - ID: {s.id}, Campaign: {s.campaign_id}, Product: {s.product_id}, Status: {s.status}, Price: {s.snapshot_price}")

if __name__ == "__main__":
    asyncio.run(check_data())
