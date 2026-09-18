import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.config import settings

logger = logging.getLogger("moneymind.database")

def create_db_engine():
    db_url = settings.DATABASE_URL
    if db_url.startswith("postgresql"):
        try:
            # Test if PostgreSQL is reachable with a short timeout
            test_engine = create_engine(db_url, connect_args={"connect_timeout": 3})
            with test_engine.connect() as conn:
                logger.info("Connected to PostgreSQL successfully.")
            return test_engine
        except Exception as e:
            if settings.FALLBACK_TO_SQLITE:
                logger.warning(
                    f"PostgreSQL connection to {db_url} failed: {e}. "
                    "Falling back to local SQLite database (sqlite:///./moneymind.db)."
                )
                return create_engine(
                    "sqlite:///./moneymind.db",
                    connect_args={"check_same_thread": False}
                )
            raise e
    elif db_url.startswith("sqlite"):
        return create_engine(db_url, connect_args={"check_same_thread": False})
    
    return create_engine(db_url)

engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
