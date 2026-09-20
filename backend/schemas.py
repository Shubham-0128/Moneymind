from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr, field_validator, ConfigDict

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

class ExpenseBase(BaseModel):
    amount: float = Field(..., gt=0, description="Expense amount must be strictly greater than 0")
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

class ExpenseUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0)
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

    model_config = ConfigDict(from_attributes=True)

class CategoryTotal(BaseModel):
    category: str
    total: float
    count: int

class ExpenseSummary(BaseModel):
    total_amount: float
    total_count: int
    total_income: float = 0.0
    total_expenses: float = 0.0
    net_balance: float = 0.0
    savings_rate: float = 0.0
    by_category: List[CategoryTotal]

# --- Budget Schemas ---

class BudgetBase(BaseModel):
    category: str = Field(..., min_length=1, max_length=50)
    monthly_limit: float = Field(..., gt=0)

class BudgetCreate(BudgetBase):
    pass

class BudgetOut(BudgetBase):
    id: str
    user_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Recurring Rule Schemas ---

class RecurringRuleBase(BaseModel):
    type: str = Field("expense", pattern="^(expense|income)$")
    amount: float = Field(..., gt=0)
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

    model_config = ConfigDict(from_attributes=True)

# --- Goal Schemas ---

class GoalBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    target_amount: float = Field(..., gt=0, description="Target amount must be strictly greater than 0")
    target_date: date

class GoalCreate(GoalBase):
    id: Optional[str] = None
    user_id: Optional[str] = None
    saved_so_far: float = Field(default=0.0, ge=0)

class GoalUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    target_amount: Optional[float] = Field(None, gt=0)
    target_date: Optional[date] = None
    saved_so_far: Optional[float] = Field(None, ge=0)

class GoalAddSavings(BaseModel):
    amount: float = Field(..., gt=0, description="Savings increment must be strictly greater than 0")

class GoalOut(GoalBase):
    id: str
    user_id: Optional[str] = None
    saved_so_far: float
    progress_percentage: float = 0.0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
