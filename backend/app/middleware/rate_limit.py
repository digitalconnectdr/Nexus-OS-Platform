"""
Rate limiting middleware using slowapi
Prevents API abuse and ensures fair usage across all users
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

# Initialize limiter
# Uses in-memory storage (no Redis needed for single instance)
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],  # Global default
    storage_uri="memory://",
    headers_enabled=True  # Add rate limit headers to response
)

# Custom rate limit exceeded handler
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """
    Custom handler for rate limit exceeded errors
    Returns 429 with helpful message
    """
    logger.warning(f"Rate limit exceeded for {get_remote_address(request)}")
    
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": "Demasiadas solicitudes. Por favor espere un momento.",
            "retry_after": exc.detail
        },
        headers={
            "Retry-After": str(exc.detail),
            "X-RateLimit-Limit": str(exc.limit.amount),
            "X-RateLimit-Remaining": "0"
        }
    )


# Rate limit decorators for different endpoint types
def rate_limit_standard():
    """Standard rate limit: 100 requests per minute"""
    return limiter.limit("100/minute")


def rate_limit_expensive():
    """Expensive operations: 20 requests per minute"""
    return limiter.limit("20/minute")


def rate_limit_auth():
    """Authentication endpoints: 10 requests per minute"""
    return limiter.limit("10/minute")


def rate_limit_export():
    """Export/download endpoints: 5 requests per minute"""
    return limiter.limit("5/minute")
