from supabase import create_client, Client
from app.core.config import settings

# Admin client with Service Role Key for administrative tasks
supabase_admin: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
