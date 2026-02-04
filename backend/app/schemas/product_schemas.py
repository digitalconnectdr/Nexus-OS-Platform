from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, Any, List
from uuid import UUID

class ProductSkillOption(BaseModel):
    label: str
    value: str

class ProductBase(BaseModel):
    name: str
    family_name: str
    plan_name: Optional[str] = None
    current_price: float
    current_pp: Optional[str] = None
    current_concept: Optional[str] = None
    incentive: Optional[float] = 0.0
    is_active: bool = True

    @field_validator("current_price", "incentive", mode="before")
    @classmethod
    def allow_none_for_numbers(cls, v: Any) -> Any:
        import math
        if v is None:
            return 0.0
        try:
            # Handle NaN for float/Decimal
            if isinstance(v, (float, int)) and math.isnan(v):
                return 0.0
            # If it's a string from CSV that passed earlier or other source
            if isinstance(v, str) and v.lower() == 'nan':
                return 0.0
        except (ValueError, TypeError):
            pass
        return v

class ProductCreate(ProductBase):
    tenant_id: UUID
    campaign_id: UUID

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    family_name: Optional[str] = None
    plan_name: Optional[str] = None
    current_price: Optional[float] = None
    current_pp: Optional[str] = None
    current_concept: Optional[str] = None
    incentive: Optional[float] = None
    is_active: Optional[bool] = None
    campaign_id: Optional[UUID] = None

class ProductResponse(ProductBase): # Renamed to match user's expected name
    id: UUID
    tenant_id: UUID
    campaign_id: Optional[UUID] = None
    campaign_name: Optional[str] = None
    is_deleted: bool = False
    model_config = ConfigDict(from_attributes=True)
