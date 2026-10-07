from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import DATABASE_URL

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_NEW_COLUMNS = (
    ("hazard_type", "VARCHAR"),
    ("source", "VARCHAR DEFAULT 'manual'"),
    ("is_demo", "INTEGER DEFAULT 0"),
    ("gone_count", "INTEGER DEFAULT 0"),
)


def migrate_schema():
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        rows = conn.execute(text("PRAGMA table_info(reports)")).fetchall()
        if not rows:
            return
        existing = {row[1] for row in rows}
        for name, ddl in _NEW_COLUMNS:
            if name not in existing:
                conn.execute(text(f"ALTER TABLE reports ADD COLUMN {name} {ddl}"))
