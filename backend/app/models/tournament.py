from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Numeric, Table, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from .base import Base

class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    bonus_amount = Column(Numeric(10, 2), default=0)
    
    # Points configuration like {"Product A": 10, "Product B": 5}
    points_config = Column(JSONB, nullable=False, server_default='{}')
    target_points = Column(Numeric(10, 0), default=100) # Target to reach for the race track
    
    # Filtering fields
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=True)
    product_family = Column(String, nullable=True)
    supervisor_id = Column(UUID(as_uuid=True), ForeignKey("users_profiles.id"), nullable=True)

    is_active = Column(Boolean, default=True)
    winner_id = Column(UUID(as_uuid=True), ForeignKey("users_profiles.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    organization = relationship("Organization")
    campaign = relationship("Campaign")
    supervisor = relationship("UserProfile", foreign_keys=[supervisor_id])
    winner = relationship("UserProfile", foreign_keys=[winner_id])
    participations = relationship("TournamentParticipation", back_populates="tournament", cascade="all, delete-orphan")

class TournamentParticipation(Base):
    __tablename__ = "tournament_participations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tournament_id = Column(UUID(as_uuid=True), ForeignKey("tournaments.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users_profiles.id"), nullable=False, index=True)
    
    is_disqualified = Column(Boolean, default=False)
    disqualification_reason = Column(Text)
    
    is_winner = Column(Boolean, default=False)
    award_details = Column(JSONB, nullable=False, server_default='{}')
    
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    tournament = relationship("Tournament", back_populates="participations")
    user = relationship("UserProfile")
    
    __table_args__ = (
        UniqueConstraint('tournament_id', 'user_id', name='_tournament_user_uc'),
    )
