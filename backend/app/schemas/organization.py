from typing import Optional, Any
from pydantic import BaseModel, ConfigDict, field_validator
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
    is_deleted: Optional[bool] = None

class OrganizationOut(OrganizationBase):
    id: UUID
    name: str
    slug: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

    @field_validator('created_at', mode='before')
    @classmethod
    def normalize_datetime(cls, v: Any) -> datetime:
        if v is None:
            # Fallback for safety only, field is technically required
            return datetime.now()
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except ValueError:
                return datetime.now()
        return v
