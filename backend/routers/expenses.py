from datetime import date
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import extract, func, case
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Expense, User
from backend.schemas import ExpenseCreate, ExpenseUpdate, ExpenseOut, ExpenseSummary, CategoryTotal
from backend.security import get_current_user

router = APIRouter(prefix="/api/expenses", tags=["Expenses"])

@router.get("", response_model=List[ExpenseOut])
def list_expenses(
    category: Optional[str] = None,
    type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Expense).filter(Expense.user_id == current_user.id)
    if type:
        query = query.filter(Expense.type == type.lower())
    if category:
        query = query.filter(Expense.category == category.capitalize())
    if start_date:
        query = query.filter(Expense.date >= start_date)
    if end_date:
        query = query.filter(Expense.date <= end_date)

    return query.order_by(Expense.date.desc(), Expense.created_at.desc()).all()

@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    expense = Expense(
        id=payload.id if payload.id else None,
        user_id=current_user.id,
        type=payload.type,
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
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    base_filter = [Expense.user_id == current_user.id]
    if year is not None:
        base_filter.append(extract("year", Expense.date) == year)
    if month is not None:
        base_filter.append(extract("month", Expense.date) == month)

    # 1. Aggregate financial totals directly in the database
    totals_row = db.query(
        func.coalesce(func.sum(Expense.amount), Decimal("0.00")).label("total_amount"),
        func.count(Expense.id).label("total_count"),
        func.coalesce(
            func.sum(case((Expense.type == "income", Expense.amount), else_=Decimal("0.00"))),
            Decimal("0.00")
        ).label("total_income"),
        func.coalesce(
            func.sum(case((Expense.type == "expense", Expense.amount), else_=Decimal("0.00"))),
            Decimal("0.00")
        ).label("total_expenses")
    ).filter(*base_filter).first()

    total_amount = totals_row.total_amount if totals_row else Decimal("0.00")
    total_count = totals_row.total_count if totals_row else 0
    total_income = totals_row.total_income if totals_row else Decimal("0.00")
    total_expenses = totals_row.total_expenses if totals_row else Decimal("0.00")

    net_balance = total_income - total_expenses
    savings_rate = round(float(net_balance / total_income * 100), 1) if total_income > 0 else 0.0

    # 2. Aggregate category totals directly in the database
    cat_rows = db.query(
        Expense.category,
        func.coalesce(func.sum(Expense.amount), Decimal("0.00")).label("cat_total"),
        func.count(Expense.id).label("cat_count")
    ).filter(*base_filter).group_by(Expense.category).order_by(func.sum(Expense.amount).desc()).all()

    by_category = [
        CategoryTotal(category=cat, total=cat_total, count=cat_count)
        for cat, cat_total, cat_count in cat_rows
    ]

    return ExpenseSummary(
        total_amount=total_amount,
        total_count=total_count,
        total_income=total_income,
        total_expenses=total_expenses,
        net_balance=net_balance,
        savings_rate=savings_rate,
        by_category=by_category
    )


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(
    expense_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == current_user.id
    ).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with id '{expense_id}' not found."
        )
    return expense

@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: str,
    payload: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == current_user.id
    ).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with id '{expense_id}' not found."
        )

    if payload.type is not None:
        expense.type = payload.type
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
def delete_expense(
    expense_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == current_user.id
    ).first()
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with id '{expense_id}' not found."
        )

    db.delete(expense)
    db.commit()
    return {"detail": f"Expense '{expense_id}' successfully deleted."}

