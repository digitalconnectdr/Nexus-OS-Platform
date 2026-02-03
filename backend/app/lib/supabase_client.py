"""
Supabase client for backend operations (OPTIONAL)
Only required for async report generation (large reports >= 1000 rows)
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import Supabase - it's optional
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Client for regular operations (uses anon key with RLS)
supabase: Optional[Client] = None
# Client for admin operations (bypasses RLS)
supabase_admin: Optional[Client] = None

if SUPABASE_AVAILABLE and SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized successfully")
    except Exception as e:
        logger.warning(f"Could not initialize Supabase client: {e}")

if SUPABASE_AVAILABLE and SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        logger.info("Supabase admin client initialized successfully")
    except Exception as e:
        logger.warning(f"Could not initialize Supabase admin client: {e}")


def get_supabase_client() -> Client:
    """Get Supabase client with RLS"""
    if not SUPABASE_AVAILABLE:
        raise Exception("Supabase library not installed. Run: pip install supabase-py")
    if not supabase:
        raise Exception("Supabase client not initialized. Check SUPABASE_URL and SUPABASE_ANON_KEY")
    return supabase


def get_supabase_admin() -> Client:
    """Get Supabase admin client (bypasses RLS)"""
    if not SUPABASE_AVAILABLE:
        raise Exception("Supabase library not installed. Run: pip install supabase-py")
    if not supabase_admin:
        raise Exception("Supabase admin client not initialized. Check SUPABASE_SERVICE_ROLE_KEY")
    return supabase_admin

