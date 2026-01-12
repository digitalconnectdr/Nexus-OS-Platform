from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from .base import Base

class SalesGoal(Base):
    __tablename__ = "sales_goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users_profiles.id"), nullable=True) # Adjusted to users_profiles
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=True)
    product_family = Column(String, nullable=False, default="GENERAL")

    month = Column(String, nullable=False, index=True)
    target_amount = Column(Float, default=0)
    target_units = Column(Integer, default=0)
    target_daily_amount = Column(Float, default=0)
    target_daily_count = Column(Integer, default=0)
    
    is_manual_daily = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relaciones usando strings para evitar Circular Import
    campaign = relationship("Campaign") # Simplified from user code to follow internal naming
    agent = relationship("UserProfile", back_populates="goals") # Adjusted for UserProfile
    product = relationship("Product") 
    organization = relationship("Organization")

    def calculate_daily_targets(self, working_days: int):
        if not self.is_manual_daily and working_days > 0:
            self.target_daily_amount = self.target_amount / working_days
            self.target_daily_count = int(self.target_units / working_days)
