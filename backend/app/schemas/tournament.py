from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID
from decimal import Decimal

class TournamentBase(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: datetime
    end_date: datetime
    bonus_amount: Decimal = Field(default=0, max_digits=10, decimal_places=2)
    points_config: Dict[str, int] = Field(default_factory=dict)
    target_points: int = Field(default=100)
    campaign_id: Optional[UUID] = None
    product_family: Optional[str] = None
    supervisor_id: Optional[UUID] = None
    is_active: bool = True
    winner_id: Optional[UUID] = None

class TournamentCreate(TournamentBase):
    pass

class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    bonus_amount: Optional[Decimal] = None
    points_config: Optional[Dict[str, int]] = None
    target_points: Optional[int] = None
    campaign_id: Optional[UUID] = None
    product_family: Optional[str] = None
    supervisor_id: Optional[UUID] = None
    is_active: Optional[bool] = None
    winner_id: Optional[UUID] = None

class Tournament(TournamentBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    winner_name: Optional[str] = None

    class Config:
        from_attributes = True

class TournamentParticipationBase(BaseModel):
    is_disqualified: bool = False
    disqualification_reason: Optional[str] = None
    is_winner: bool = False
    award_details: Dict[str, Any] = Field(default_factory=dict)

class TournamentParticipationCreate(TournamentParticipationBase):
    user_id: UUID
    tournament_id: UUID

class TournamentParticipation(TournamentParticipationBase):
    id: UUID
    user_id: UUID
    tournament_id: UUID
    joined_at: datetime

    class Config:
        from_attributes = True

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: UUID
    full_name: str
    points: int
    sales_count: int
    is_disqualified: bool = False
    disqualification_reason: Optional[str] = None
    is_winner: bool = False
    award_details: Dict[str, Any] = Field(default_factory=dict)

class LeaderboardResponse(BaseModel):
    tournament_id: UUID
    tournament_name: str
    entries: List[LeaderboardEntry]
