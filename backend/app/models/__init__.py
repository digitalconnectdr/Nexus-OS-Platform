from app.core.database import Base
from app.models.core import Organization, UserProfile, Campaign, Product, SalesOrder
from app.models.sales_goal import SalesGoal
from app.models.status import Status

# Alias para compatibilidad con código legado o Maestro
User = UserProfile

# Export symbols to ensure they are registered with Base.metadata
__all__ = [
    "Base",
    "Organization",
    "UserProfile",
    "User",  # Alias Fénix
    "Campaign",
    "Product",
    "SalesOrder",
    "SalesGoal",
    "Status"
]
