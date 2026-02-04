from pydantic import BaseModel, ConfigDict, model_validator
from uuid import UUID
from datetime import datetime
from typing import Optional

# Esquema Local Seguro para Producto
class ProductLite(BaseModel):
    id: UUID
    name: str
    family_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# Esquema Local Seguro para Agente
class AgentLite(BaseModel):
    id: UUID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class SalesOrderOut(BaseModel):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Customer Info
    customer_name: Optional[str] = None
    customer_doc_id: Optional[str] = None
    customer_contact: Optional[str] = None
    
    # Operational IDs
    agent_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    campaign_id: Optional[UUID] = None
    
    # Snapshots
    snapshot_family: Optional[str] = None
    snapshot_product_name: Optional[str] = None
    snapshot_plan: Optional[str] = None
    snapshot_price: float = 0.0
    snapshot_pp: Optional[str] = None
    snapshot_concept: Optional[str] = None
    
    # Status and Others
    status: Optional[str] = "pending"
    os_madre: Optional[str] = None
    os_hija: Optional[str] = None
    assigned_to: Optional[str] = None
    inst_num: Optional[str] = None
    last_updated_by: Optional[str] = None
    modified_fields: Optional[list] = []
    modified_fields: Optional[list] = []
    last_status_change: Optional[dict] = None
    is_deleted: bool = False
    
    # Relationships (Optional objects for the table)
    agent: Optional[AgentLite] = None
    digitizer: Optional[AgentLite] = None
    product: Optional[ProductLite] = None
    agent_email: Optional[str] = None
    campaign_name: Optional[str] = None
    digitizer_name: Optional[str] = None # Nuevo campo de salida

    @model_validator(mode="after")
    def sync_assigned_to(self) -> "SalesOrderOut":
        if self.digitizer_name:
            self.assigned_to = self.digitizer_name
        return self

    model_config = ConfigDict(from_attributes=True)
