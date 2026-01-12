from pydantic import BaseModel, Field, validator
from typing import Optional, Any, Dict
from uuid import UUID
from datetime import date
# Importamos Campaign y User, pero NO Product para evitar el ciclo
from .campaign_schemas import CampaignResponse 
from .user_schemas import UserResponse
from .product_schemas import ProductResponse

class SalesGoalBase(BaseModel):
    campaign_id: UUID
    product_id: Optional[UUID] = None 
    month: str = Field(..., description="Formato YYYY-MM-DD")
    target_amount: float = Field(ge=0)
    target_units: int = Field(ge=0)
    target_daily_amount: Optional[float] = 0
    target_daily_count: Optional[int] = 0
    is_manual_daily: Optional[bool] = False
    is_active: Optional[bool] = True
    product_family: str = "GENERAL"

    @validator('month')
    def validate_month_format(cls, v):
        # Permitimos YYYY-MM (lo completamos luego) o YYYY-MM-DD
        if len(v) == 7:
             return v
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError("Formato de fecha inválido")
        return v

class SalesGoalCreate(SalesGoalBase):
    user_id: Optional[UUID] = None
    tenant_id: Optional[UUID] = None

class SalesGoalBulkCreate(BaseModel):
    items: list[SalesGoalCreate]

class SalesGoalUpdate(BaseModel):
    target_amount: Optional[float] = None
    target_units: Optional[int] = None
    target_daily_amount: Optional[float] = None
    target_daily_count: Optional[int] = None
    is_manual_daily: Optional[bool] = None
    is_active: Optional[bool] = None
    product_family: Optional[str] = None

class SalesGoalResponse(SalesGoalBase):
    id: UUID
    user_id: Optional[UUID] = None
    tenant_id: UUID
    created_at: Any
    
    # Objetos anidados
    campaign: Optional[CampaignResponse] = None
    agent: Optional[UserResponse] = Field(alias="user", default=None)
    
    # SOLUCIÓN DEFINITIVA: Usamos ProductResponse en lugar de Dict.
    # Pydantic 2 con from_attributes=True manejará la conversión del modelo SQLAlchemy.
    product: Optional[ProductResponse] = None 

    class Config:
        from_attributes = True
        populate_by_name = True