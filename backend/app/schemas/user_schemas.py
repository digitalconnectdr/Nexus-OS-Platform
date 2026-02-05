from pydantic import BaseModel, ConfigDict, Field, field_validator
from uuid import UUID
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum
import json

class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMINISTRADOR = "administrador"
    GERENTE = "gerente"
    SUPERVISOR_SENIOR = "supervisor_senior"
    SUPERVISOR = "supervisor"
    LIDER = "lider"  # Keep for backward compatibility if needed, or map to supervisor
    REPRESENTANTE = "representante"
    DPTO_ESTADISTICA = "dpto_estadistica"
    SEGUIMIENTO = "seguimiento"
    AUDITOR_CALIDAD = "auditor_calidad"
    DIGITACION = "digitacion"
    CLIENTE = "cliente"

    @classmethod
    def _missing_(cls, value: object):
        """Handle legacy/variant role strings by normalizing them before validation."""
        if isinstance(value, str):
            normalized = value.lower().replace(" ", "_").strip()
            # Special case mapping if needed
            if normalized == "super_admin":
                return cls.SUPER_ADMIN
            # Try to return the member if it matches the normalized value
            for member in cls:
                if member.value == normalized:
                    return member
        return None

class UserProfileBase(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[UserRole] = None 
    tenant_id: Optional[UUID] = None # Added for easier access
    avatar_url: Optional[str] = None
    is_active: bool = True
    is_deleted: bool = False
    skills: Optional[List[Any]] = []
    supervisor_id: Optional[UUID] = None
    default_campaign_id: Optional[UUID] = None
    join_date: Optional[datetime] = None
    vicidial_user: Optional[str] = None
    card_number: Optional[str] = None
    product_skill: Optional[str] = None # Legacy
    product_skills: Optional[List[str]] = [] # New Multi-Skill field
    custom_max_tasks: Optional[int] = None # Capacity Override

    @field_validator('skills', 'product_skills', mode='before')
    @classmethod
    def set_default_list(cls, v: Any) -> List[Any]:
        if v is None:
            return []
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return []
        return v

class UserProfileCreate(UserProfileBase):
    id: UUID # Subapase User ID
    tenant_id: UUID

class UserResponse(UserProfileBase):
    id: UUID
    tenant_id: UUID
    organization_name: Optional[str] = None # For display in user table
    email: Optional[str] = None
    last_seen_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
