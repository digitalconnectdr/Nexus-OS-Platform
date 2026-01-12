from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, UUID, ForeignKey, DateTime, text
import uuid

Base = declarative_base()

class TenantBase(Base):
    __abstract__ = True
    
    tenant_id = Column(
        UUID(as_uuid=True), 
        ForeignKey("organizations.id"), 
        nullable=False,
        index=True
    )

class TimestampBase(Base):
    __abstract__ = True
    
    created_at = Column(
        DateTime(timezone=True), 
        server_default=text("now()"), 
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True), 
        onupdate=text("now()"), 
        nullable=True
    )
