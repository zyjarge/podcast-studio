from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings


def _is_sqlite_url(url: str) -> bool:
    return url.startswith("sqlite")


# Issue #21: SQLite without WAL + busy_timeout degrades badly under
# concurrent load. WAL allows one writer alongside many readers, and
# busy_timeout makes SQLite wait instead of immediately raising
# SQLITE_BUSY when a writer collision is brief. Set both on every new
# SQLite connection via SQLAlchemy's connect event listener.
if _is_sqlite_url(settings.DATABASE_URL):
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={
            "check_same_thread": False,
            # 5s busy_timeout: prefer waiting over raising SQLITE_BUSY.
            "timeout": 5,
        },
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            # WAL: readers don't block writers, writers don't block readers.
            cursor.execute("PRAGMA journal_mode=WAL")
            # NORMAL is the WAL sweet spot: fsync on checkpoint, not per-statement.
            cursor.execute("PRAGMA synchronous=NORMAL")
            # bound busy_timeout so concurrent reads get queued briefly
            # instead of immediately failing with SQLITE_BUSY.
            cursor.execute("PRAGMA busy_timeout=5000")
            # foreign keys require explicit opt-in on every new connection.
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()
else:
    engine = create_engine(settings.DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
