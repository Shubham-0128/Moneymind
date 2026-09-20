import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.config import settings
from backend.database import init_db, SessionLocal, engine
from backend.models import User
from backend.security import hash_password
from backend.routers import auth, expenses, goals, ai

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("moneymind")

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def seed_demo_user():
    # Only seed demo account if explicitly enabled and not in production
    if not settings.ENABLE_DEMO_USER or settings.ENVIRONMENT == "production":
        return

    db = SessionLocal()
    try:
        demo_email = settings.DEMO_USER_EMAIL.lower().strip()
        existing = db.query(User).filter(User.email == demo_email).first()
        if not existing:
            demo_user = User(
                id="usr_demo_8821",
                email=demo_email,
                name="Alex Morgan",
                password_hash=hash_password(settings.DEMO_USER_PASSWORD),
                is_demo=True
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)
            logger.info(f"Demo user '{demo_email}' seeded.")

            # Seed initial demo financial records directly into database
            from datetime import date, timedelta
            from decimal import Decimal
            from backend.models import Expense, Goal

            today = date.today()
            sample_expenses = [
                Expense(user_id=demo_user.id, type="income", amount=Decimal("85000.00"), category="Salary", date=today - timedelta(days=18), note="Monthly tech salary"),
                Expense(user_id=demo_user.id, type="income", amount=Decimal("15000.00"), category="Freelance", date=today - timedelta(days=7), note="Design consulting client"),
                Expense(user_id=demo_user.id, type="expense", amount=Decimal("22000.00"), category="Rent", date=today - timedelta(days=14), note="Monthly apartment rent"),
                Expense(user_id=demo_user.id, type="expense", amount=Decimal("3450.00"), category="Food", date=today - timedelta(days=2), note="Weekly organic groceries"),
                Expense(user_id=demo_user.id, type="expense", amount=Decimal("1250.00"), category="Food", date=today - timedelta(days=5), note="Dinner with colleagues"),
                Expense(user_id=demo_user.id, type="expense", amount=Decimal("850.00"), category="Transport", date=today - timedelta(days=1), note="Metro & cab passes"),
                Expense(user_id=demo_user.id, type="expense", amount=Decimal("2100.00"), category="Bills", date=today - timedelta(days=10), note="Electricity & broadband"),
                Expense(user_id=demo_user.id, type="expense", amount=Decimal("4800.00"), category="Shopping", date=today - timedelta(days=8), note="Running shoes & gear"),
                Expense(user_id=demo_user.id, type="expense", amount=Decimal("650.00"), category="Entertainment", date=today - timedelta(days=3), note="Weekend movies"),
            ]
            sample_goal = Goal(
                user_id=demo_user.id,
                name="Emergency Fund",
                target_amount=Decimal("150000.00"),
                saved_so_far=Decimal("65000.00"),
                target_date=today + timedelta(days=180)
            )
            db.add_all(sample_expenses)
            db.add(sample_goal)
            db.commit()
            logger.info("Demo financial data seeded to database.")
    except Exception as e:
        logger.error(f"Error seeding demo user: {e}")
        db.rollback()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database schema...")
    init_db()
    seed_demo_user()
    yield
    # Shutdown
    logger.info("Shutting down MoneyMind API.")

app = FastAPI(
    title=settings.APP_NAME,
    description="REST API data layer for MoneyMind, a full-stack personal finance application supporting authenticated expense tracking, savings goals, and AI-assisted financial tips.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration with restricted origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Centralized Error Handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": True,
            "status_code": exc.status_code,
            "detail": exc.detail
        }
    )

from fastapi.encoders import jsonable_encoder

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = " -> ".join(str(loc) for loc in err.get("loc", []))
        msg = err.get("msg", "Invalid input")
        errors.append(f"{field}: {msg}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=jsonable_encoder({
            "error": True,
            "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
            "detail": "; ".join(errors),
            "errors": exc.errors()
        })
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error processing request: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": True,
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "detail": "Internal server error occurred."
        }
    )

# Routers
app.include_router(auth.router)
app.include_router(expenses.router)
app.include_router(goals.router)
app.include_router(ai.router)
app.add_api_route("/api/suggestions", ai.get_suggestions, methods=["POST"], response_model=ai.AISuggestionsResponse, tags=["AI Budget Coaching"])

@app.get("/api/health", tags=["Health"])

def health_check():
    db_dialect = engine.dialect.name
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "database_dialect": db_dialect
    }

# Serve root index.html and frontend static assets if requested
@app.get("/", include_in_schema=False)
async def serve_index():
    index_file = os.path.join(ROOT_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "MoneyMind API is running. Go to /docs for Swagger UI."}

@app.get("/{file_path:path}", include_in_schema=False)
async def serve_static_asset(file_path: str):
    # Do not intercept /api or docs
    if file_path.startswith("api") or file_path.startswith("docs") or file_path.startswith("openapi.json"):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    safe_file = os.path.join(ROOT_DIR, file_path)
    if os.path.isfile(safe_file) and not file_path.startswith("backend") and not file_path.startswith("."):
        return FileResponse(safe_file)
    return JSONResponse(status_code=404, content={"detail": "Not Found"})
