from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from typing import Optional

class StatusSimple(BaseModel):
    id: UUID
    name: str
    color_hex: str
    model_config = ConfigDict(from_attributes=True)

class CampaignBase(BaseModel):
    name: str
    campaign_code: Optional[str] = None
    is_active: bool = True
    default_status_id: Optional[UUID] = None

class CampaignCreate(CampaignBase):
    tenant_id: UUID

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    campaign_code: Optional[str] = None
    is_active: Optional[bool] = None
    default_status_id: Optional[UUID] = None

class CampaignResponse(CampaignBase):
    id: UUID
    tenant_id: UUID
    is_deleted: bool = False
    default_status: Optional[StatusSimple] = None
    model_config = ConfigDict(from_attributes=True)
