from typing import Optional
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from uuid import UUID

class OrganizationBase(BaseModel):
    name: str
    slug: Optional[str] = None

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationUpdate(OrganizationBase):
    name: Optional[str] = None
    slug: Optional[str] = None

class OrganizationOut(OrganizationBase):
    id: UUID
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
