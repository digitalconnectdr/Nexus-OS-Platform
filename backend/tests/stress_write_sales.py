import asyncio
import httpx
import time
import uuid
import sys
import os
from sqlalchemy import select, func
from datetime import datetime

# Aadir el path del backend para importar el app y modelos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app
from app.core.database import SessionLocal
from app.core.security import get_current_user
from app.models.core import Campaign, Product, UserProfile, SalesOrder, Organization
from app.schemas.user_schemas import UserRole

CONCURRENCY = 50

async def get_test_context():
    async with SessionLocal() as db:
        admin = (await db.execute(select(UserProfile).where(UserProfile.role == "Super Admin").limit(1))).scalar()
        campaign = (await db.execute(select(Campaign).limit(1))).scalar()
        product = (await db.execute(select(Product).limit(1))).scalar()
        
        if not admin or not campaign or not product:
            # Fallback a buscar cualquier dato si no hay Super Admin
            admin = (await db.execute(select(UserProfile).limit(1))).scalar()
            
        if not admin or not campaign or not product:
            raise Exception("Faltan datos maestros para la prueba.")
            
        return {
            "admin": admin,
            "campaign_id": str(campaign.id),
            "product_id": str(product.id),
            "tenant_id": str(admin.tenant_id)
        }

async def create_sale_task(client, context, task_id):
    payload = {
        "customer_name": f"Stress Test Client {task_id}",
        "customer_doc_id": f"DOC-{task_id}-{int(time.time())}",
        "customer_contact": "555-STRESS",
        "campaign_id": context["campaign_id"],
        "product_id": context["product_id"],
        "snapshot_price": 99.99,
        "tenant_id": context["tenant_id"]
    }
    
    start_time = time.time()
    try:
        response = await client.post("/api/v1/sales/", json=payload)
        latency = (time.time() - start_time) * 1000
        return response.status_code, latency
    except Exception as e:
        return 500, (time.time() - start_time) * 1000

async def run_stress_test():
    print(f"START: Preparando Stress Test 2.0 (Escritura)...")
    try:
        context = await get_test_context()
    except Exception as e:
        print(f"ERR: Error al obtener contexto: {e}")
        return

    # Mock de autenticacin para toda la prueba
    app.dependency_overrides[get_current_user] = lambda: context["admin"]

    print(f"INFO: Contexto: Admin={context['admin'].email}, Tenant={context['tenant_id']}")
    print(f"GO: Disparando {CONCURRENCY} ventas simultneas...")

    async with httpx.AsyncClient(app=app, base_url="http://testserver", timeout=60.0) as client:
        # Iniciamos todas las tareas al mismo tiempo
        tasks = [create_sale_task(client, context, i) for i in range(CONCURRENCY)]
        results = await asyncio.gather(*tasks)

    # Procesar resultados
    successes = [r for r in results if r[0] in [200, 201]]
    failures = [r for r in results if r[0] not in [200, 201]]
    latencies = [r[1] for r in results]
    
    avg_latency = sum(latencies) / len(latencies) if latencies else 0
    success_rate = (len(successes) / CONCURRENCY) * 100

    print("\n" + "="*50)
    print("STATS: RESULTADOS DE ESCRITURA (N=" + str(CONCURRENCY) + ")")
    print(f"OK: xitos: {len(successes)}")
    print(f"FAIL: Fallos: {len(failures)}")
    # Mostrar detalles de fallos si hay
    if failures:
        status_codes = {}
        for r in failures:
            status_codes[r[0]] = status_codes.get(r[0], 0) + 1
        print(f"   Detalle de errores: {status_codes}")
        
    print("RATE: Tasa de xito: " + f"{success_rate:.1f}%")
    print("TIME: Latencia Promedio: " + f"{avg_latency:.2f} ms")
    
    # Verificacin de Integridad en DB
    print("\nINFO: Verificando Integridad en Base de Datos...")
    async with SessionLocal() as db:
        # Contar ventas creadas hoy con el prefijo Stress Test
        count_query = select(func.count(SalesOrder.id)).where(
            SalesOrder.customer_name.like("Stress Test Client %")
        )
        db_count = (await db.execute(count_query)).scalar()
        
    print(f" Total registros Stress Test en DB: {db_count}")
    
    # Determinar veredicto (Aceptamos 500 si es error lgico, pero aqu el payload debera ser perfecto)
    verdict = "ESTABLE" if success_rate == 100 and avg_latency < 500 else "INESTABLE"
    
    print(f"DONE: Veredicto Final: {verdict}")
    print("="*50)

    # Limpiar overrides
    app.dependency_overrides.clear()

if __name__ == "__main__":
    asyncio.run(run_stress_test())
