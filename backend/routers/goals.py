from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Goal, User
from backend.schemas import GoalCreate, GoalUpdate, GoalAddSavings, GoalOut
from backend.security import get_current_user

router = APIRouter(prefix="/api/goals", tags=["Savings Goals"])

def format_goal_out(goal: Goal) -> GoalOut:
    progress = 0.0
    if goal.target_amount > 0:
        progress = round(min(100.0, float(goal.saved_so_far / goal.target_amount) * 100.0), 1)
    return GoalOut(
        id=goal.id,
        user_id=goal.user_id,
        name=goal.name,
        target_amount=goal.target_amount,
        saved_so_far=goal.saved_so_far,
        target_date=goal.target_date,
        progress_percentage=progress,
        created_at=goal.created_at
    )


@router.get("", response_model=List[GoalOut])
def list_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goals = db.query(Goal).filter(Goal.user_id == current_user.id).order_by(Goal.created_at.asc()).all()
    return [format_goal_out(g) for g in goals]

@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(
    payload: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = Goal(
        id=payload.id if payload.id else None,
        user_id=current_user.id,
        name=payload.name.strip(),
        target_amount=payload.target_amount,
        saved_so_far=payload.saved_so_far,
        target_date=payload.target_date
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return format_goal_out(goal)

@router.get("/{goal_id}", response_model=GoalOut)
def get_goal(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id
    ).first()
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Savings goal with id '{goal_id}' not found."
        )
    return format_goal_out(goal)

@router.put("/{goal_id}", response_model=GoalOut)
def update_goal(
    goal_id: str,
    payload: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id
    ).first()
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Savings goal with id '{goal_id}' not found."
        )

    if payload.name is not None:
        goal.name = payload.name.strip()
    if payload.target_amount is not None:
        goal.target_amount = payload.target_amount
    if payload.target_date is not None:
        goal.target_date = payload.target_date
    if payload.saved_so_far is not None:
        goal.saved_so_far = payload.saved_so_far

    db.commit()
    db.refresh(goal)
    return format_goal_out(goal)

@router.patch("/{goal_id}/savings", response_model=GoalOut)
def add_savings(
    goal_id: str,
    payload: GoalAddSavings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id
    ).first()
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Savings goal with id '{goal_id}' not found."
        )

    goal.saved_so_far = min(goal.target_amount, goal.saved_so_far + payload.amount)
    db.commit()
    db.refresh(goal)
    return format_goal_out(goal)


@router.delete("/{goal_id}", status_code=status.HTTP_200_OK)
def delete_goal(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id
    ).first()
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Savings goal with id '{goal_id}' not found."
        )

    db.delete(goal)
    db.commit()
    return {"detail": f"Savings goal '{goal_id}' successfully deleted."}
