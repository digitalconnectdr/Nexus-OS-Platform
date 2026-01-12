import asyncio
from app.core.database import SessionLocal
from sqlalchemy import text
import uuid

async def create_initial_data():
    print("🌱 Sembrando datos para Cascada de 4 Niveles...")
    async with SessionLocal() as session:
        # 1. Obtener ID de la Organización Demo
        res = await session.execute(text("SELECT id FROM organizations WHERE name = 'Demo Company'"))
        org_id = res.scalar()
        if not org_id:
            print("❌ No se encontró 'Demo Company'. Por favor crea la organización primero.")
            return

        # 2. Asegurar Campañas
        campaigns = [
            {"name": "Claro Hogar", "id": str(uuid.uuid4())},
            {"name": "Claro Móvil", "id": str(uuid.uuid4())}
        ]
        
        for camp in campaigns:
            # Check if exists
            res = await session.execute(text("SELECT id FROM campaigns WHERE name = :name"), {"name": camp["name"]})
            existing = res.scalar()
            if not existing:
                await session.execute(
                    text("INSERT INTO campaigns (id, tenant_id, name, is_active) VALUES (:id, :tid, :name, true)"),
                    {"id": camp["id"], "tid": org_id, "name": camp["name"]}
                )
                print(f"✅ Campaña '{camp['name']}' creada.")
            else:
                camp["id"] = str(existing)

        # 3. Sembrar Productos (Cascada: Campaña > Producto > Familia > Plan)
        products_to_seed = [
            # Claro Hogar
            {"camp": "Claro Hogar", "name": "Internet Fibra", "family": "Duo (Internet + TV)", "plan": "Plan 200MB + TV Lite", "price": 85000, "pp": "PP-HOGAR-01"},
            {"camp": "Claro Hogar", "name": "Internet Fibra", "family": "Duo (Internet + TV)", "plan": "Plan 500MB + TV Full", "price": 125000, "pp": "PP-HOGAR-02"},
            {"camp": "Claro Hogar", "name": "Internet Fibra", "family": "Solo Internet", "plan": "Plan 300MB Silver", "price": 65000, "pp": "PP-HOGAR-03"},
            # Claro Móvil
            {"camp": "Claro Móvil", "name": "Planes Postpago", "family": "Sin Límite", "plan": "Postpago 50GB Gold", "price": 49900, "pp": "PP-MOVIL-01"},
            {"camp": "Claro Móvil", "name": "Planes Postpago", "family": "Premium", "plan": "Postpago Ilimitado Black", "price": 79900, "pp": "PP-MOVIL-02"},
        ]

        for p in products_to_seed:
            cid = next(c["id"] for c in campaigns if c["name"] == p["camp"])
            
            # Check if plan exists
            res = await session.execute(
                text("SELECT id FROM products WHERE plan_name = :plan AND campaign_id = :cid"),
                {"plan": p["plan"], "cid": cid}
            )
            if not res.scalar():
                await session.execute(
                    text("""
                        INSERT INTO products (tenant_id, campaign_id, name, family_name, plan_name, current_price, current_pp, current_concept, incentive, is_active)
                        VALUES (:tid, :cid, :name, :family, :plan, :price, :pp, 'Mensualidad', 5000, true)
                    """),
                    {
                        "tid": org_id, "cid": cid, "name": p["name"], 
                        "family": p["family"], "plan": p["plan"], 
                        "price": p["price"], "pp": p["pp"]
                    }
                )
                print(f"✅ Producto sembrado: {p['plan']}")

        await session.commit()
        print("🚀 Datos de cascada listos.")

if __name__ == "__main__":
    asyncio.run(create_initial_data())
