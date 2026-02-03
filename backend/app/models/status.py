from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from .base import Base

class Status(Base):
    __tablename__ = "statuses" # Renamed to match user's expected table name

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    color_hex = Column(String, default="#CBD5E0")
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    is_active_work = Column(Boolean, default=True, nullable=False) # Explicitly added as per user request
    is_productive = Column(Boolean, default=False, nullable=False) # Mark which statuses count as a "Sale"
    scope = Column(String, default="DASHBOARD", nullable=False) # DASHBOARD | ARCHIVE
