import asyncio
import httpx
import uuid
import sys
import os
from typing import Any

# Añadir el path del backend para importar app y modelos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app
from app.core.security import get_current_user
from app.models.core import UserProfile, Campaign, Product
from app.core.database import SessionLocal
from sqlalchemy import select

async def get_test_context():
    async with SessionLocal() as db:
        # Buscamos un Representante para el token (o lo simulamos)
        rep = (await db.execute(select(UserProfile).where(UserProfile.role == "Representante").limit(1))).scalar()
        campaign = (await db.execute(select(Campaign).limit(1))).scalar()
        product = (await db.execute(select(Product).limit(1))).scalar()
        
        if not rep:
            # Si no hay uno, usamos un Super Admin pero simulando el rol
            rep = (await db.execute(select(UserProfile).limit(1))).scalar()
            
        return {
            "user": rep,
            "campaign_id": str(campaign.id) if campaign else str(uuid.uuid4()),
            "product_id": str(product.id) if product else str(uuid.uuid4()),
            "tenant_id": str(rep.tenant_id)
        }

async def run_test():
    print("Iniciando Prueba de Integridad de Negocio (Logic Flaws)...\n")
    
    context = await get_test_context()
    app.dependency_overrides[get_current_user] = lambda: context["user"]
    
    results = []
    
    async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
        
        # Caso 1: Venta Negativa (Quantity/Price)
        # Probaremos con snapshot_price negativo ya que quantity no existe en el modelo base
        payload1 = {
            "customer_name": "Neg Test",
            "campaign_id": context["campaign_id"],
            "product_id": context["product_id"],
            "snapshot_price": -50.0,
            "quantity": -10  # Enviar aunque no exista para ver validación de Body
        }
        resp1 = await ac.post("/api/v1/sales/", json=payload1)
        results.append({
            "CASO": "Venta Negativa",
            "ACCION": "Price -50, Qty -10",
            "ESPERADO": "Error 400/422",
            "OBTENIDO": f"{resp1.status_code} {resp1.reason_phrase}",
            "ESTADO": "✅ PASS" if resp1.status_code in [400, 422] else "❌ FALLO GRAVE"
        })

        # Caso 2: Precio Cero
        payload2 = {
            "customer_name": "Zero Test",
            "campaign_id": context["campaign_id"],
            "product_id": context["product_id"],
            "snapshot_price": 0.0
        }
        resp2 = await ac.post("/api/v1/sales/", json=payload2)
        # Asumimos que el sistema debería permitirlo si es una promo, pero marcamos advertencia
        results.append({
            "CASO": "Precio Cero",
            "ACCION": "Price 0.0",
            "ESPERADO": "Check Policy (200/400)",
            "OBTENIDO": f"{resp2.status_code}",
            "ESTADO": "⚠️ INFO" if resp2.status_code == 200 else "✅ RECHAZADO"
        })

        # Caso 3: Producto Inexistente
        payload3 = {
            "customer_name": "Fake Prod Test",
            "campaign_id": context["campaign_id"],
            "product_id": str(uuid.uuid4()), # UUID Random
            "snapshot_price": 10.0
        }
        resp3 = await ac.post("/api/v1/sales/", json=payload3)
        results.append({
            "CASO": "Producto Inexistente",
            "ACCION": "Random UUID Product",
            "ESPERADO": "404/500 (FK Error)",
            "OBTENIDO": f"{resp3.status_code}",
            "ESTADO": "✅ PASS" if resp3.status_code in [404, 500] else "❌ FALLO (FK Leak)"
        })

        # Caso 4: Cliente Fantasma (Campaign Inexistente en este caso)
        payload4 = {
            "customer_name": "Fake Camp Test",
            "campaign_id": str(uuid.uuid4()),
            "product_id": context["product_id"],
            "snapshot_price": 10.0
        }
        resp4 = await ac.post("/api/v1/sales/", json=payload4)
        results.append({
            "CASO": "Campaña Fantasma",
            "ACCION": "Random UUID Campaign",
            "ESPERADO": "404/500 (FK Error)",
            "OBTENIDO": f"{resp4.status_code}",
            "ESTADO": "✅ PASS" if resp4.status_code in [404, 500] else "❌ FALLO (FK Leak)"
        })

        # Caso 5: SQL Injection en Texto
        injection_str = "'; DROP TABLE sales_test_safety; --"
        payload5 = {
            "customer_name": injection_str,
            "campaign_id": context["campaign_id"],
            "product_id": context["product_id"],
            "snapshot_price": 10.0
        }
        resp5 = await ac.post("/api/v1/sales/", json=payload5)
        # Verificamos si se guardó literal
        status_pass = False
        if resp5.status_code == 200:
            data = resp5.json()
            if data["customer_name"] == injection_str:
                status_pass = True
        
        results.append({
            "CASO": "SQL Injection",
            "ACCION": "'; DROP TABLE...",
            "ESPERADO": "Literal Storage (200)",
            "OBTENIDO": f"{resp5.status_code}",
            "ESTADO": "✅ PASS (Sanitizado)" if status_pass else "❌ FALLO"
        })

    # Imprimir Reporte
    print(f"{'CASO':<20} | {'ACCIÓN':<20} | {'ESPERADO':<20} | {'OBTENIDO':<18} | {'ESTADO'}")
    print("-" * 105)
    for r in results:
        print(f"{r['CASO']:<20} | {r['ACCION']:<20} | {r['ESPERADO']:<20} | {r['OBTENIDO']:<18} | {r['ESTADO']}")
    
    app.dependency_overrides.clear()

if __name__ == "__main__":
    asyncio.run(run_test())
