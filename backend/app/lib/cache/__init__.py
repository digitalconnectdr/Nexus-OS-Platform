"""
Simple in-memory cache for API responses
Reduces database load for frequently accessed data
"""
from functools import wraps
from datetime import datetime, timedelta
from typing import Any, Optional, Callable
import hashlib
import json
import logging

logger = logging.getLogger(__name__)

# Simple in-memory cache
_cache: dict[str, tuple[Any, datetime]] = {}

def cache_response(ttl_seconds: int = 300):
    """
    Decorator to cache function responses
    
    Args:
        ttl_seconds: Time to live in seconds (default: 5 minutes)
    
    Usage:
        @cache_response(ttl_seconds=300)
        async def get_dashboard_data(month: str):
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create cache key from function name and arguments
            cache_key = _create_cache_key(func.__name__, args, kwargs)
            
            # Check if cached and not expired
            if cache_key in _cache:
                cached_value, expiry_time = _cache[cache_key]
                if datetime.now() < expiry_time:
                    logger.debug(f"Cache HIT for {func.__name__}")
                    return cached_value
                else:
                    # Remove expired entry
                    del _cache[cache_key]
                    logger.debug(f"Cache EXPIRED for {func.__name__}")
            
            # Cache miss - execute function
            logger.debug(f"Cache MISS for {func.__name__}")
            result = await func(*args, **kwargs)
            
            # Store in cache with expiry time
            expiry_time = datetime.now() + timedelta(seconds=ttl_seconds)
            _cache[cache_key] = (result, expiry_time)
            
            return result
        
        return wrapper
    return decorator


def _create_cache_key(func_name: str, args: tuple, kwargs: dict) -> str:
    """Create a unique cache key from function name and arguments"""
    # Convert args and kwargs to a stable string representation
    key_parts = [func_name]
    
    # Add positional args (skip 'self' or 'db' session objects)
    for arg in args:
        if not hasattr(arg, '__class__') or arg.__class__.__name__ not in ['AsyncSession', 'Session']:
            key_parts.append(str(arg))
    
    # Add keyword args (sorted for consistency)
    for k in sorted(kwargs.keys()):
        v = kwargs[k]
        if not hasattr(v, '__class__') or v.__class__.__name__ not in ['AsyncSession', 'Session']:
            key_parts.append(f"{k}={v}")
    
    # Create hash of the key parts
    key_string = "|".join(key_parts)
    return hashlib.md5(key_string.encode()).hexdigest()


def clear_cache(pattern: Optional[str] = None):
    """
    Clear cache entries
    
    Args:
        pattern: If provided, only clear keys containing this pattern
                If None, clear all cache
    """
    global _cache
    
    if pattern is None:
        count = len(_cache)
        _cache.clear()
        logger.info(f"Cleared entire cache ({count} entries)")
    else:
        keys_to_delete = [k for k in _cache.keys() if pattern in k]
        for key in keys_to_delete:
            del _cache[key]
        logger.info(f"Cleared {len(keys_to_delete)} cache entries matching '{pattern}'")


def get_cache_stats() -> dict:
    """Get cache statistics"""
    now = datetime.now()
    active_entries = sum(1 for _, expiry in _cache.values() if expiry > now)
    expired_entries = len(_cache) - active_entries
    
    return {
        "total_entries": len(_cache),
        "active_entries": active_entries,
        "expired_entries": expired_entries
    }
