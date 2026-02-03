from pydantic import BaseModel
from typing import List

class CommissionTier(BaseModel):
    name: str # e.g. "Bronze", "Silver"
    min_sales: int
    commission_rate: float
    is_current: bool = False

class ProjectionScenario(BaseModel):
    additional_sales: int
    projected_total_sales: int
    projected_commission_amount: float
    incremental_earnings: float
    new_tier_name: str

class CommissionProjectionResponse(BaseModel):
    current_sales_count: int
    current_sales_value: float
    current_commission_amount: float
    current_tier: CommissionTier
    next_tier: CommissionTier | None
    sales_to_next_tier: int
    scenarios: List[ProjectionScenario]
