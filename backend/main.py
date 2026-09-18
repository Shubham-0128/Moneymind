import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.config import settings
from backend.database import init_db, SessionLocal, engine
from backend.models import User
from backend.security import hash_password
from backend.routers import auth, expenses, goals

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("moneymind")

def seed_demo_user():
    db = SessionLocal()
    try:
        demo_email = "demo@moneymind.app"
        existing = db.query(User).filter(User.email == demo_email).first()
        if not existing:
            demo_user = User(
                id="usr_demo_8821",
                email=demo_email,
                name="Alex Morgan",
                password_hash=hash_password("Demo123!"),
                is_demo=True
            )
            db.add(demo_user)
            db.commit()
            logger.info("Demo user 'demo@moneymind.app' successfully seeded.")
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
    description="Production-ready REST API data layer for MoneyMind financial dashboard.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
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

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        field = " -> ".join(str(loc) for loc in err.get("loc", []))
        msg = err.get("msg", "Invalid input")
        errors.append(f"{field}: {msg}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": True,
            "status_code": status.HTTP_422_UNPROCESSABLE_ENTITY,
            "detail": "; ".join(errors),
            "errors": exc.errors()
        }
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

@app.get("/api/health", tags=["Health"])
def health_check():
    db_dialect = engine.dialect.name
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "database_dialect": db_dialect
    }
