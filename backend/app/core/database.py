from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# 1. Crear el Engine (Optimizado para Supabase Free Tier - 15 conexiones max)
# Estrategia: Pool pequeño + overflow + reciclaje agresivo
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    # Pool conservador para no exceder límite de Supabase
    pool_size=5,           # Conexiones permanentes (reducido de 10)
    max_overflow=8,        # Conexiones temporales (total max: 13, dejando margen)
    pool_recycle=300,      # Reciclar cada 5 min (más agresivo que 30 min)
    pool_pre_ping=True,    # Verificar conexiones antes de usar
    pool_timeout=30,       # Timeout para obtener conexión del pool
    connect_args={
        "statement_cache_size": 0,
        "server_settings": {
            "application_name": "ai_saas_platform",
            "jit": "off"  # Desactivar JIT para queries más rápidos
        }
    }
)

# 2. Crear la SessionLocal
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# 3. DEFINIR BASE (Esto es lo que faltaba para arreglar el error)
Base = declarative_base()
