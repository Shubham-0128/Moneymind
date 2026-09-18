from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend.models import Expense
from backend.schemas import ExpenseCreate, ExpenseUpdate, ExpenseOut, ExpenseSummary, CategoryTotal

router = APIRouter(prefix="/api/expenses", tags=["Expenses"])

@router.get("", response_model=List[ExpenseOut])
def list_expenses(
    category: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Expense)
    if user_id:
        query = query.filter(Expense.user_id == user_id)
    if category:
        query = query.filter(Expense.category == category.capitalize())
    if start_date:
        query = query.filter(Expense.date >= start_date)
    if end_date:
        query = query.filter(Expense.date <= end_date)

    return query.order_by(Expense.date.desc(), Expense.created_at.desc()).all()

@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(payload: ExpenseCreate, db: Session = Depends(get_db)):
    expense = Expense(
        id=payload.id if payload.id else None,
        user_id=payload.user_id,
        amount=payload.amount,
        category=payload.category,
        date=payload.date,
        note=payload.note
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense

@router.get("/summary", response_model=ExpenseSummary)
def get_expense_summary(
    user_id: Optional[str] = None,
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    db: Session = Depends(get_db)
):
    query = db.query(Expense)
    if user_id:
        query = query.filter(Expense.user_id == user_id)
    
    # Optional month/year filtering
    all_expenses = query.all()
    if month and year:
        expenses = [e for e in all_expenses if e.date.month == month and e.date.year == year]
    else:
        expenses = all_expenses

    total_amount = sum(e.amount for e in expenses)
    total_count = len(expenses)

    cat_map = {}
    for e in expenses:
        if e.category not in cat_map:
            cat_map[e.category] = {"total": 0.0, "count": 0}
        cat_map[e.category]["total"] += e.amount
        cat_map[e.category]["count"] += 1

    by_category = [
        CategoryTotal(category=cat, total=data["total"], count=data["count"])
        for cat, data in sorted(cat_map.items(), key=lambda x: x[1]["total"], reverse=True)
    ]

    return ExpenseSummary(
        total_amount=round(total_amount, 2),
        total_count=total_count,
        by_category=by_category
    )

@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(expense_id: str, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with id '{expense_id}' not found."
        )
    return expense

@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: str, payload: ExpenseUpdate, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with id '{expense_id}' not found."
        )

    if payload.amount is not None:
        expense.amount = payload.amount
    if payload.category is not None:
        expense.category = payload.category
    if payload.date is not None:
        expense.date = payload.date
    if payload.note is not None:
        expense.note = payload.note

    db.commit()
    db.refresh(expense)
    return expense

@router.delete("/{expense_id}", status_code=status.HTTP_200_OK)
def delete_expense(expense_id: str, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with id '{expense_id}' not found."
        )

    db.delete(expense)
    db.commit()
    return {"detail": f"Expense '{expense_id}' successfully deleted."}
