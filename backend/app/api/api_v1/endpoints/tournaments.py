from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from uuid import UUID

from app.api import deps
from app.core.security import get_current_user, check_permission
from app.models import Tournament, TournamentParticipation, SalesOrder, UserProfile, Status
from app.schemas.tournament import (
    Tournament as TournamentSchema,
    TournamentCreate,
    TournamentUpdate,
    LeaderboardResponse,
    LeaderboardEntry
)

router = APIRouter()

@router.get("/", response_model=List[TournamentSchema])
async def read_tournaments(
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("tournaments", "view_module")),
    skip: int = 0,
    limit: int = 100,
):
    """View active tournaments for the organization."""
    # check_permission implemented as dependency
    
    stmt = select(
        Tournament,
        UserProfile
    ).outerjoin(
        UserProfile, Tournament.winner_id == UserProfile.id
    ).where(
        Tournament.tenant_id == current_user.tenant_id
    ).offset(skip).limit(limit).order_by(Tournament.is_active.desc(), Tournament.end_date.desc())
    
    result = await db.execute(stmt)
    tournaments = []
    for row in result.all():
        t = row[0]
        user = row[1]
        t.winner_name = user.full_name if user else None
        tournaments.append(t)
    return tournaments

@router.post("/", response_model=TournamentSchema)
async def create_tournament(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("tournaments", "create_battle")),
    tournament_in: TournamentCreate
):
    """Create a new tournament (Admin only)."""
    # check_permission implemented as dependency
    
    db_obj = Tournament(
        **tournament_in.dict(),
        tenant_id=current_user.tenant_id
    )
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.get("/{tournament_id}/leaderboard", response_model=LeaderboardResponse)
async def get_leaderboard(
    tournament_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("tournaments", "view_race_track"))
):
    """Calculate and return the live leaderboard for a tournament."""
    # check_permission implemented as dependency
    
    # 1. Fetch Tournament
    stmt = select(Tournament).where(
        Tournament.id == tournament_id,
        Tournament.tenant_id == current_user.tenant_id
    )
    result = await db.execute(stmt)
    tournament = result.scalar_one_or_none()
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")

    # 2. Fetch Participations
    part_stmt = select(TournamentParticipation, UserProfile).join(
        UserProfile, TournamentParticipation.user_id == UserProfile.id
    ).where(TournamentParticipation.tournament_id == tournament_id)
    
    # If tournament is restricted to a supervisor's team
    if tournament.supervisor_id:
        part_stmt = part_stmt.where(UserProfile.supervisor_id == tournament.supervisor_id)
        
    part_result = await db.execute(part_stmt)
    participations = part_result.all()

    # 3. Fetch Sales in Date Range with 'COMPLETADA' or 'INSTALADA' status
    valid_statuses = ['COMPLETADA', 'INSTALADA']

    filters = [
        SalesOrder.tenant_id == current_user.tenant_id,
        SalesOrder.status.in_(valid_statuses),
        SalesOrder.created_at >= tournament.start_date,
        SalesOrder.created_at <= tournament.end_date
    ]
    
    if tournament.campaign_id:
        filters.append(SalesOrder.campaign_id == tournament.campaign_id)
    if tournament.product_family:
        filters.append(SalesOrder.snapshot_family == tournament.product_family)
    if tournament.supervisor_id:
        filters.append(SalesOrder.supervisor_id == tournament.supervisor_id)

    sales_stmt = select(
        SalesOrder.agent_id,
        SalesOrder.snapshot_family,
        func.count(SalesOrder.id).label('count')
    ).where(and_(*filters)).group_by(SalesOrder.agent_id, SalesOrder.snapshot_family)

    sales_result = await db.execute(sales_stmt)
    all_sales = sales_result.all()

    # 4. Calculate Scores
    points_map = tournament.points_config or {}
    agent_scores = {} # agent_id -> {points, count}
    
    for sale in all_sales:
        agent_id = sale.agent_id
        family = sale.snapshot_family
        count = sale.count
        
        # Get points from config for this family
        points_per_unit = points_map.get(family, 0)
        total_points = float(points_per_unit) * count
        
        if agent_id not in agent_scores:
            agent_scores[agent_id] = {"points": 0, "count": 0}
        
        agent_scores[agent_id]["points"] += total_points
        agent_scores[agent_id]["count"] += count

    # 5. Build Leaderboard Entries
    entries = []
    for part, user in participations:
        score = agent_scores.get(user.id, {"points": 0, "count": 0})
        entries.append(LeaderboardEntry(
            rank=0, # Will sort later
            user_id=user.id,
            full_name=user.full_name,
            points=score["points"],
            sales_count=score["count"],
            is_disqualified=part.is_disqualified,
            disqualification_reason=part.disqualification_reason,
            is_winner=part.is_winner,
            award_details=part.award_details
        ))

    # Sort and rank
    entries.sort(key=lambda x: (not x.is_disqualified, x.points, x.sales_count), reverse=True)
    
    # Re-calculate rank properly for non-disqualified
    current_rank = 1
    for entry in entries:
        if not entry.is_disqualified:
            entry.rank = current_rank
            current_rank += 1
        else:
            entry.rank = 999 # Disqualified at bottom

    return LeaderboardResponse(
        tournament_id=tournament.id,
        tournament_name=tournament.name,
        entries=entries
    )

@router.post("/{tournament_id}/disqualify/{user_id}")
async def disqualify_agent(
    tournament_id: UUID,
    user_id: UUID,
    reason: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("tournaments", "arbitration_panel"))
):
    """Disqualify an agent from a tournament (Admin only)."""
    # check_permission implemented as dependency
    
    stmt = select(TournamentParticipation).where(
        TournamentParticipation.tournament_id == tournament_id,
        TournamentParticipation.user_id == user_id
    )
    result = await db.execute(stmt)
    participation = result.scalar_one_or_none()
    
    if not participation:
        raise HTTPException(status_code=404, detail="Participation not found")
        
    participation.is_disqualified = True
    participation.disqualification_reason = reason
    await db.commit()
    return {"status": "success", "message": "Agent disqualified"}

@router.post("/{tournament_id}/award/{user_id}")
async def award_prize(
    tournament_id: UUID,
    user_id: UUID,
    award_name: str,
    award_value: Optional[float] = 0,
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("tournaments", "arbitration_panel"))
):
    """Award a prize to an agent in a tournament (Admin only)."""
    stmt = select(TournamentParticipation).where(
        TournamentParticipation.tournament_id == tournament_id,
        TournamentParticipation.user_id == user_id
    )
    result = await db.execute(stmt)
    participation = result.scalar_one_or_none()
    
    if not participation:
        raise HTTPException(status_code=404, detail="Participation not found")
        
    participation.is_winner = True
    participation.award_details = {
        "name": award_name,
        "value": award_value,
        "awarded_at": str(func.now()),
        "awarded_by": str(current_user.id)
    }

    # Finalize tournament logic
    tournament_stmt = select(Tournament).where(Tournament.id == tournament_id)
    t_result = await db.execute(tournament_stmt)
    tournament = t_result.scalar_one_or_none()
    
    if tournament:
        tournament.is_active = False
        tournament.winner_id = user_id
        db.add(tournament)

    await db.commit()
    return {"status": "success", "message": "Prize awarded successfully"}
@router.put("/{tournament_id}", response_model=TournamentSchema)
async def update_tournament(
    tournament_id: UUID,
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("tournaments", "edit")),
    tournament_in: TournamentUpdate
):
    """Update a tournament (Admin only)."""
    stmt = select(Tournament).where(
        Tournament.id == tournament_id,
        Tournament.tenant_id == current_user.tenant_id
    )
    result = await db.execute(stmt)
    db_obj = result.scalar_one_or_none()
    
    if not db_obj:
        raise HTTPException(status_code=404, detail="Tournament not found")
        
    update_data = tournament_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
        
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.delete("/{tournament_id}")
async def delete_tournament(
    tournament_id: UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user: UserProfile = Depends(get_current_user),
    _: bool = Depends(check_permission("tournaments", "delete"))
):
    """Delete a tournament (Admin only)."""
    stmt = select(Tournament).where(
        Tournament.id == tournament_id,
        Tournament.tenant_id == current_user.tenant_id
    )
    result = await db.execute(stmt)
    db_obj = result.scalar_one_or_none()
    
    if not db_obj:
        raise HTTPException(status_code=404, detail="Tournament not found")
        
    await db.delete(db_obj)
    await db.commit()
    return {"status": "success", "message": "Tournament deleted"}
