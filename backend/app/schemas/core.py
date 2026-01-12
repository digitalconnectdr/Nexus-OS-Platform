from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any, Generic, TypeVar
from enum import Enum

# Import the modularized schemas so core.py acts as a bridge
from .campaign_schemas import CampaignBase, CampaignUpdate, CampaignCreate, CampaignResponse as CampaignOut
from .user_schemas import UserRole, UserProfileBase, UserProfileCreate, UserResponse as UserProfileOut, datetime as user_datetime
from .goal_schemas import SalesGoalBase as MonthlyGoalBase, SalesGoalCreate as MonthlyGoalCreate, SalesGoalUpdate as MonthlyGoalUpdate, SalesGoalResponse as MonthlyGoalOut
from .product_schemas import ProductBase, ProductCreate, ProductUpdate, ProductResponse as ProductOut, ProductSkillOption

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    total: int
    page: int
    size: int
    items: List[T]

# --- Organization ---
class OrganizationBase(BaseModel):
    name: str
    slug: str

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationOut(OrganizationBase):
    id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- User Profile Related (Bridge) ---
class UserIdentityCreate(BaseModel):
    email: str
    password: str
    tenant_id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[UserRole] = None

class UserPasswordUpdate(BaseModel):
    password: str
    confirm_password: str

class StatsOut(BaseModel):
    total_revenue: float
    total_sales: int
    average_ticket: float


# --- Monthly Goal Related (Bridge) ---
class MonthlyGoalBulkCreate(BaseModel):
    items: List[MonthlyGoalCreate]

# --- Sales Status ---
class StatusBase(BaseModel):
    name: str
    color_hex: str
    is_active: bool = True
    is_default: bool = False
    is_active_work: bool = True
    is_productive: bool = False

class StatusCreate(StatusBase):
    tenant_id: UUID

class StatusOut(StatusBase):
    id: UUID
    tenant_id: UUID
    model_config = ConfigDict(from_attributes=True)

class RolePermissionOut(BaseModel):
    id: UUID
    role: UserRole
    module: str
    resource: str
    action: str
    is_allowed: bool
    model_config = ConfigDict(from_attributes=True)

class PermissionToggle(BaseModel):
    target_role: UserRole
    resource: str
    action: str
    value: bool

class CampaignSimple(BaseModel):
    id: UUID
    name: str
    campaign_code: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# --- Sales Order ---
class SalesOrderBase(BaseModel):
    customer_name: Optional[str] = None
    customer_doc_id: Optional[str] = None
    customer_contact: Optional[str] = None
    campaign_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    os_madre: Optional[str] = None
    os_hija: Optional[str] = None
    status: Optional[str] = "Pending"
    assigned_to: Optional[str] = None
    comms_claro: Optional[float] = 0.0
    comms_orion: Optional[float] = 0.0
    comms_dofu: Optional[float] = 0.0
    inst_num: Optional[str] = None
    last_updated_by: Optional[str] = None
    modified_fields: Optional[list] = []
    last_status_change: Optional[dict] = None
    snapshot_price: Optional[float] = 0.0
    snapshot_pp: Optional[str] = ""
    snapshot_concept: Optional[str] = ""
    snapshot_family: Optional[str] = None

class SalesOrderCreate(SalesOrderBase):
    tenant_id: UUID
    agent_id: Optional[UUID] = None
    snapshot_family: Optional[str] = None
    snapshot_product_name: Optional[str] = None
    snapshot_plan: Optional[str] = None

class SalesOrderOut(SalesOrderBase):
    id: UUID
    tenant_id: UUID
    created_at: Optional[datetime] = None
    agent_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    snapshot_product_name: Optional[str] = None
    snapshot_plan: Optional[str] = None
    product: Optional[ProductOut] = None
    campaign: Optional[CampaignSimple] = None
    campaign_name: Optional[str] = None # For flat display
    model_config = ConfigDict(from_attributes=True)

# --- Role Policies ---
class RolePolicyBase(BaseModel):
    role: UserRole
    smart_routing_enabled: bool = False
    default_limit: int = 5
    workable_statuses: List[str] = ["PENDIENTE"]

class RolePolicyCreate(RolePolicyBase):
    tenant_id: UUID

class RolePolicyUpdate(BaseModel):
    smart_routing_enabled: Optional[bool] = None
    default_limit: Optional[int] = None
    workable_statuses: Optional[List[str]] = None

class RolePolicyOut(RolePolicyBase):
    id: UUID
    tenant_id: UUID
    model_config = ConfigDict(from_attributes=True)
