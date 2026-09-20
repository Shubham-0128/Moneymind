from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Annotated
from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict, PlainSerializer

# Serializes Decimal as float in API JSON responses while enforcing Decimal precision in models
MoneyDecimal = Annotated[
    Decimal,
    PlainSerializer(lambda x: float(x) if x is not None else None, return_type=float, when_used="json")
]

# Base schema ensuring proper ORM reading
class FinancialBaseModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# --- User Schemas ---

class UserBase(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=2, max_length=100)

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(UserBase):
    id: str
    is_demo: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Expense Schemas ---

ALLOWED_CATEGORIES = {
    # Expenses
    "Food", "Rent", "Transport", "Bills", "Shopping",
    "Entertainment", "Health", "Education", "Other",
    # Income
    "Salary", "Freelance", "Investment", "Gift", "Refund"
}

class ExpenseBase(FinancialBaseModel):
    amount: MoneyDecimal = Field(..., gt=0, decimal_places=2, description="Expense amount must be strictly greater than 0")
    category: str = Field(..., min_length=1, max_length=50)
    date: date
    note: Optional[str] = Field(None, max_length=255)
    type: str = Field("expense", pattern="^(expense|income)$")

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        clean = v.strip().capitalize()
        # If matches known categories with different casing, standardize it
        for allowed in ALLOWED_CATEGORIES:
            if clean.lower() == allowed.lower():
                return allowed
        if not clean:
            raise ValueError("Category cannot be empty")
        return clean

class ExpenseCreate(ExpenseBase):
    id: Optional[str] = None
    user_id: Optional[str] = None

class ExpenseUpdate(FinancialBaseModel):
    amount: Optional[MoneyDecimal] = Field(None, gt=0, decimal_places=2)
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    date: Optional[date] = None
    note: Optional[str] = Field(None, max_length=255)
    type: Optional[str] = Field(None, pattern="^(expense|income)$")

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        clean = v.strip().capitalize()
        for allowed in ALLOWED_CATEGORIES:
            if clean.lower() == allowed.lower():
                return allowed
        if not clean:
            raise ValueError("Category cannot be empty")
        return clean

class ExpenseOut(ExpenseBase):
    id: str
    user_id: Optional[str] = None
    created_at: datetime

class CategoryTotal(FinancialBaseModel):
    category: str
    total: MoneyDecimal
    count: int

class ExpenseSummary(FinancialBaseModel):
    total_amount: MoneyDecimal
    total_count: int
    total_income: MoneyDecimal = Decimal("0.00")
    total_expenses: MoneyDecimal = Decimal("0.00")
    net_balance: MoneyDecimal = Decimal("0.00")
    savings_rate: float = 0.0
    by_category: List[CategoryTotal]

# --- Budget Schemas ---

class BudgetBase(FinancialBaseModel):
    category: str = Field(..., min_length=1, max_length=50)
    monthly_limit: MoneyDecimal = Field(..., gt=0, decimal_places=2)

class BudgetCreate(BudgetBase):
    pass

class BudgetOut(BudgetBase):
    id: str
    user_id: Optional[str] = None
    created_at: datetime

# --- Recurring Rule Schemas ---

class RecurringRuleBase(FinancialBaseModel):
    type: str = Field("expense", pattern="^(expense|income)$")
    amount: MoneyDecimal = Field(..., gt=0, decimal_places=2)
    category: str = Field(..., min_length=1, max_length=50)
    frequency: str = Field("monthly", pattern="^(weekly|monthly|yearly)$")
    next_date: date
    note: Optional[str] = Field(None, max_length=255)

class RecurringRuleCreate(RecurringRuleBase):
    pass

class RecurringRuleOut(RecurringRuleBase):
    id: str
    user_id: Optional[str] = None
    created_at: datetime

# --- Goal Schemas ---

class GoalBase(FinancialBaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    target_amount: MoneyDecimal = Field(..., gt=0, decimal_places=2, description="Target amount must be strictly greater than 0")
    target_date: date

class GoalCreate(GoalBase):
    id: Optional[str] = None
    user_id: Optional[str] = None
    saved_so_far: MoneyDecimal = Field(default=Decimal("0.00"), ge=0, decimal_places=2)

class GoalUpdate(FinancialBaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    target_amount: Optional[MoneyDecimal] = Field(None, gt=0, decimal_places=2)
    target_date: Optional[date] = None
    saved_so_far: Optional[MoneyDecimal] = Field(None, ge=0, decimal_places=2)

class GoalAddSavings(FinancialBaseModel):
    amount: MoneyDecimal = Field(..., gt=0, decimal_places=2, description="Savings increment must be strictly greater than 0")

class GoalOut(GoalBase):
    id: str
    user_id: Optional[str] = None
    saved_so_far: MoneyDecimal
    progress_percentage: float = 0.0
    created_at: datetime


