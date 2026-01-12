from typing import List, Optional, Any
from pydantic import BaseModel, Field, field_validator

# --- BLOQUES BASE ---
class MetricBase(BaseModel):
    """Métricas financieras comunes para evitar repetición"""
    target_amount: float = 0.0
    target_units: float = 0.0
    sold_amount: float = 0.0
    sold_count: float = 0.0
    compliance_amount: float = 0.0
    compliance_units: float = 0.0
    projection_amount: float = 0.0
    projection_units: float = 0.0
    pilar_estatus: str = "Good"  # Critical, Good, etc.
    pilar_color: str = "blue"    # red, green, yellow, blue

class ProductMetric(MetricBase):
    product_name: str
    product_id: Optional[str] = None

# --- MODELOS PRINCIPALES ---

class EfficiencySupervisorMetric(MetricBase):
    id: str
    first_name: str = "Supervisor" # Valor por defecto seguro
    last_name: Optional[str] = ""
    avatar_url: Optional[str] = None
    campaign_name: Optional[str] = "General"
    products: List[ProductMetric] = []

class EfficiencyCampaignParentMetric(MetricBase):
    campaign_id: str
    campaign_name: str
    # Hacemos estos campos OPCIONALES para que no fallen si son None
    first_name: Optional[str] = None 
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    products: List[ProductMetric] = []

# --- RESPUESTA DE LA API ---

class EfficiencyResponse(BaseModel):
    month: str
    total_supervisors: int = 0
    # Listas flexibles
    supervisors: List[EfficiencySupervisorMetric] = []
    campaigns_view: List[EfficiencyCampaignParentMetric] = []
    
    # Metadatos para filtros
    metadata_supervisors: List[Any] = []
    metadata_campaigns: List[Any] = []
    metadata_families: List[Any] = []

# --- DASHBOARD PRINCIPAL (NUEVOS SCHEMAS) ---

class CampaignMetric(BaseModel):
    campaign_name: str
    leads_generated: int
    conversion_rate: float
    active: bool

class SupervisorMetric(BaseModel):
    supervisor_name: str
    team_efficiency: float
    active_agents: int

class GoalCompliance(BaseModel):
    metric_name: str
    target: float
    current: float
    status: str # 'On Track', 'Risk', 'Behind'

class OperationsMetrics(BaseModel):
    by_campaign: List[CampaignMetric]
    by_supervisor: List[SupervisorMetric]

class DashboardData(BaseModel):
    period_start: str
    period_end: str
    operations_metrics: OperationsMetrics
    goals_compliance: List[GoalCompliance]
