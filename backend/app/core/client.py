import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Cargar variables de entorno si no están cargadas
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
# Usamos la Service Key para que el Backend tenga permiso de leer/escribir sin restricciones
# (Ideal para tareas de fondo o dashboards administrativos)
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan las credenciales de Supabase en el archivo .env")

# Cliente instanciado una sola vez
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
