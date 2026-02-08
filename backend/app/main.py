from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
import time
import logging
from app.core.database import engine, Base
from app.core.config import settings

print("FORCE DEPLOY V3 - COMMIT HASH VERIFICATION")

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
    campaign_performance, finance, selectors, ops, tournaments,
    health, maintenance
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

# --- GLOBAL OPS STATE ---
app.state.error_count_500 = 0

# Static File Serving (Backups)
from fastapi.staticfiles import StaticFiles
import os
static_dir = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir, exist_ok=True)
exports_dir = os.path.join(static_dir, "exports")
if not os.path.exists(exports_dir):
    os.makedirs(exports_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Add rate limiting state and exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# --- GLOBAL EXCEPTION HANDLER (DEBUG) ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    error_msg = f"[FATAL ERROR] {request.method} {request.url}\n{traceback.format_exc()}"
    print(error_msg) # Esto sale en los logs de Render
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error (See logs for traceback)"},
    )

@app.on_event("startup")
async def on_startup():
    # Asegurar que las tablas existan en el primer arranque (Zero-Touch Prod)
    logger.info("🚀 [STARTUP] Inicializando infraestructura de Base de Datos...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ [STARTUP] Tablas sincronizadas correctamente.")


# --------------------------------------------------------------------------------
# CRITICAL: CORS MIDDLEWARE MUST BE THE LAST ADDED TO BE THE FIRST EXECUTED
# --------------------------------------------------------------------------------
logger.info("🔧 Configuring CORS Middleware...")

try:
    # 1. Get origins from settings or fallback
    allowed_origins_raw = getattr(settings, "BACKEND_CORS_ORIGINS", "*")
    
    # 2. Parse origins
    if allowed_origins_raw == "*":
        origins = ["*"]
    elif isinstance(allowed_origins_raw, list):
        origins = allowed_origins_raw
    else:
        origins = [o.strip() for o in allowed_origins_raw.split(",")]
    
    # 3. Add Hardcoded Vercel Origin (Safety Net)
    vercel_origin = "https://nexus-os-platform.vercel.app"
    if vercel_origin not in origins and "*" not in origins:
        origins.append(vercel_origin)
        
    logger.info(f"✅ CORS Allowed Origins: {origins}")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=3600
    )
except Exception as e:
    logger.error(f"❌ CORS Setup Failed: {e}")
    # Fallback permissive for recovery
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=3600
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
        
        # Track 500 errors
        if response.status_code == 500:
            app.state.error_count_500 += 1
            
        return response
    except Exception as e:
        app.state.error_count_500 += 1
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
app.include_router(finance.router, prefix="/api/v1/finance", tags=["finance"])
app.include_router(selectors.router, prefix="/api/v1/selectors", tags=["selectors"])
app.include_router(ops.router, prefix="/api/v1/ops", tags=["ops"])
app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(maintenance.router, prefix="/api/v1/maintenance", tags=["maintenance"])

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
    
    print(">>> [DEBUG CRITICO] EXITO: La instruccion app.include_router se ejecuto sin romper el codigo.")

except Exception as e:
    print(f">>> [DEBUG CRITICO] ERROR FATAL AL REGISTRAR: {str(e)}")
    import traceback
    traceback.print_exc()

app.include_router(tournaments.router, prefix="/api/v1/tournaments", tags=["tournaments"])

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
    # Imprimimos TODAS las rutas para verificar registro correcto
    for route in app.routes:
        path = getattr(route, "path", "")
        if "/api/v1/" in path or "/health" in path:
            print(f"📍 RUTA ACTIVA: {path}  --> Métodos: {route.methods}")
    
    print("="*60 + "\n")