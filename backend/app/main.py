from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
import time
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# IMPORTA TODOS LOS MODELOS para registro global en SQLAlchemy
from app.models import *

# --- IMPORTACIONES DE ROUTERS ESTÁNDAR ---
from app.api.api_v1.endpoints import (
    auth, users, sales, goals, config, campaigns, products, 
    organizations, statuses, permissions, policies, analytics,
    campaign_performance
)

# --- IMPORTACIÓN QUIRÚRGICA (BYPASS DE EMERGENCIA) ---
from app.api.api_v1.endpoints.operational import router as results_router

# Import rate limiting
from app.middleware.rate_limit import limiter, rate_limit_exceeded_handler

app = FastAPI(
    title="AI SaaS Platform API",
    version="1.0.0",
    description="Backend de alta concurrencia con FastAPI y Supabase"
)

# Add rate limiting state and exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Configuración de CORS (Seguridad)
origins = [
    "http://localhost:3000", # Next.js local
    "*" 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- LOGGING MIDDLEWARE ---
@app.middleware("http")
async def log_requests(request: Request, call_next):
    origin = request.headers.get('origin', 'No Origin')
    print(f"[REQUEST] {request.method} {request.url} | Origin: {origin}")
    
    start_time = time.time()
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        print(f"[RESPONSE] {response.status_code} | Time: {process_time:.3f}s")
        return response
    except Exception as e:
        import traceback
        error_msg = f"[CRASH] {request.method} {request.url} | Error: {str(e)}"
        print(error_msg)
        traceback.print_exc()
        
        # Devolvemos un JSONResponse manual para asegurar que las cabeceras CORS
        # se incluyan incluso en caso de error fatal 500.
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal Server Error: {str(e)}"},
            headers={
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Credentials": "true"
            }
        )

# --- REGISTRO DE RUTAS ---
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(sales.router, prefix="/api/v1/sales", tags=["sales"])
app.include_router(goals.router, prefix="/api/v1/goals", tags=["goals"])
app.include_router(config.router, prefix="/api/v1/config", tags=["config"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(campaigns.router, prefix="/api/v1/campaigns", tags=["campaigns"])
app.include_router(products.router, prefix="/api/v1/products", tags=["products"])
app.include_router(organizations.router, prefix="/api/v1/organizations", tags=["organizations"])
app.include_router(statuses.router, prefix="/api/v1/statuses", tags=["statuses"])
app.include_router(permissions.router, prefix="/api/v1/permissions", tags=["permissions"])
app.include_router(policies.router, prefix="/api/v1/policies", tags=["policies"])
app.include_router(campaign_performance.router, prefix="/api/v1/campaign-performance", tags=["campaign-performance"])

# --- INYECCIÓN DIRECTA DE LA RUTA DE RESULTADOS (PRUEBA DEL GRITO) ---
print("\n" + "="*60)
print(">>> [DEBUG CRÍTICO] INICIO: Intentando registrar ruta '/api/v1/results'...")

try:
    # 1. Verificar cuántas rutas tiene el router antes de inyectarlo
    # Si sale 0, el problema es operational.py. Si sale > 0, el router está vivo.
    num_rutas = len(results_router.routes)
    print(f">>> [DEBUG CRÍTICO] El router 'operational' contiene {num_rutas} ruta(s) definidas.")

    # 2. Registrar la ruta
    app.include_router(results_router, prefix="/api/v1/results", tags=["Resultados Operativos"])
    
    print(">>> [DEBUG CRÍTICO] ✅ ÉXITO: La instrucción app.include_router se ejecutó sin romper el código.")

except Exception as e:
    print(f">>> [DEBUG CRÍTICO] ❌ ERROR FATAL AL REGISTRAR: {str(e)}")
    import traceback
    traceback.print_exc()

print("="*60 + "\n")


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}

@app.get("/")
def read_root():
    return {"status": "System Online", "cors_enabled": True}

# --- REVELADOR DE RUTAS (DEBUG) ---
@app.on_event("startup")
async def startup_event():
    print("\n" + "="*20 + " MAPA DE RUTAS OFICIAL " + "="*20)
    found = False
    for route in app.routes:
        # Buscamos cualquier ruta que contenga 'results'
        if "results" in getattr(route, "path", ""):
            print(f"📍 RUTA ACTIVA: {route.path}  --> Métodos: {route.methods}")
            found = True
    
    if not found:
        print("❌ NO SE ENCONTRÓ LA RUTA 'results' EN EL MAPA FINAL.")
    print("="*60 + "\n")