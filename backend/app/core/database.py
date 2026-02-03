from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# 1. Ajuste de URL para Transaction Pooler (Infraestructura)
db_url = str(settings.DATABASE_URL)
if ":5432" in db_url:
    print("🔄 Cambiando puerto 5432 -> 6543 para compatibilidad IPv4/Supavisor")
    db_url = db_url.replace(":5432", ":6543")

# 2. Configuración del Engine compatible con Supavisor (Transaction Mode)
# "statement_cache_size": 0 es la CLAVE para eliminar el error InvalidSQLStatementNameError
engine = create_async_engine(
    db_url,
    pool_size=20,          # Tamaño del Pool Local
    max_overflow=10,       # Margen para picos
    pool_pre_ping=True,    # Auto-curación de conexiones
    pool_recycle=300,      # Rotación cada 5 min
    connect_args={
        "statement_cache_size": 0,  # <--- ESTO DESACTIVA LOS PREPARED STATEMENTS
        "timeout": 30,             # General command timeout (seconds)
        "command_timeout": 30      # Synonym used by some asyncpg versions
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

# 3. DEFINIR BASE
Base = declarative_base()
