import asyncio
import os
from dotenv import load_dotenv

# Cargar variables de entorno antes de importar componentes del app
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from app.core.database import SessionLocal
from app.models import UserProfile, SalesGoal, SalesOrder, Organization, Campaign, Product
from sqlalchemy import text, select
import uuid
import random
from datetime import datetime, timedelta

async def seed():
    async with SessionLocal() as db:
        print("🚀 Iniciando siembra de datos operativos...")
        
        # 1. Asegurar Organización
        res = await db.execute(select(Organization).where(Organization.name == 'Demo Company'))
        org = res.scalar()
        if not org:
            org = Organization(id=uuid.uuid4(), name='Demo Company', slug='demo-company')
            db.add(org)
            await db.flush()
            print("✅ Organización Demo creada.")

        # 2. Asegurar Campaña
        res = await db.execute(select(Campaign).where(Campaign.tenant_id == org.id).limit(1))
        camp = res.scalar()
        if not camp:
            camp = Campaign(id=uuid.uuid4(), tenant_id=org.id, name='Claro Demo', is_active=True)
            db.add(camp)
            await db.flush()
            print("✅ Campaña Demo creada.")
        
        # 3. Asegurar Producto
        res = await db.execute(select(Product).where(Product.campaign_id == camp.id).limit(1))
        prod = res.scalar()
        if not prod:
            prod = Product(
                id=uuid.uuid4(), 
                tenant_id=org.id, 
                campaign_id=camp.id, 
                name='Internet Fibra', 
                family_name='Solo Internet', 
                current_price=1000, 
                is_active=True
            )
            db.add(prod)
            await db.flush()
            print("✅ Producto Demo creado.")

        # 4. Crear/Actualizar Supervisores
        # (Resto del código igual...)

        # 2. Crear/Actualizar Supervisores
        sup_data = [
            {"email": "sup.senior@demo.com", "first": "Carlos", "last": "Senior", "role": "Supervisor senior"},
            {"email": "sup.team@demo.com", "first": "Ana", "last": "Lider", "role": "Supervision"}
        ]
        
        supervisors = []
        for s in sup_data:
            res = await db.execute(select(UserProfile).where(UserProfile.email == s["email"]))
            existing = res.scalar()
            if not existing:
                # Nota: En un sistema real usaríamos el ID de auth.users, 
                # aquí simplemente generamos uno para el perfil.
                u = UserProfile(
                    id=uuid.uuid4(),
                    tenant_id=org.id,
                    email=s["email"],
                    first_name=s["first"],
                    last_name=s["last"],
                    role=s["role"],
                    is_active=True
                )
                db.add(u)
                await db.flush()
                supervisors.append(u)
            else:
                existing.role = s["role"]
                supervisors.append(existing)

        # 3. Crear Agentes
        agents = []
        for i in range(10):
            email = f"agente{i}@demo.com"
            res = await db.execute(select(UserProfile).where(UserProfile.email == email))
            existing = res.scalar()
            sup = supervisors[i % 2]
            if not existing:
                a = UserProfile(
                    id=uuid.uuid4(),
                    tenant_id=org.id,
                    email=email,
                    first_name=f"Agente {i}",
                    last_name="Prueba",
                    role="agent",
                    supervisor_id=sup.id,
                    is_active=True
                )
                db.add(a)
                await db.flush()
                agents.append(a)
            else:
                existing.supervisor_id = sup.id
                agents.append(existing)

        # 4. Crear Metas Enero 2026
        month = "2026-01"
        for a in agents:
            # Check if goal exists
            res = await db.execute(select(SalesGoal).where(SalesGoal.user_id == a.id, SalesGoal.month == month))
            if not res.scalar():
                g = SalesGoal(
                    tenant_id=org.id,
                    campaign_id=camp.id,
                    user_id=a.id,
                    month=month,
                    target_amount=random.randint(50000, 150000),
                    target_units=random.randint(10, 30),
                    is_active=True
                )
                db.add(g)

        # 5. Crear Ventas Enero 2026 (Logro Actual) e Intercaladas en Diciembre 2025 (Cierre anterior)
        # Ventas Enero
        for a in agents:
            num_sales = random.randint(5, 25)
            for _ in range(num_sales):
                s = SalesOrder(
                    tenant_id=org.id,
                    agent_id=a.id,
                    product_id=prod.id,
                    campaign_id=camp.id,
                    supervisor_id=a.supervisor_id,
                    snapshot_price=random.randint(4000, 8000),
                    status="Approved",
                    created_at=datetime(2026, 1, random.randint(1, 8))
                )
                db.add(s)
        
        # Ventas Diciembre (para pace_diff)
        for a in agents:
            num_sales = random.randint(10, 20)
            for _ in range(num_sales):
                s = SalesOrder(
                    tenant_id=org.id,
                    agent_id=a.id,
                    product_id=prod.id,
                    campaign_id=camp.id,
                    supervisor_id=a.supervisor_id,
                    snapshot_price=random.randint(4000, 8000),
                    status="Approved",
                    created_at=datetime(2025, 12, random.randint(1, 28))
                )
                db.add(s)

        await db.commit()
        print("✅ Datos operativos sembrados con éxito.")

if __name__ == "__main__":
    asyncio.run(seed())
