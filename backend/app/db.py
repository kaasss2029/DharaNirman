from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


database_url = get_settings().database_url
is_sqlite = database_url.startswith("sqlite")

engine_kwargs = {}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def initialize_database() -> None:
    from . import models  # noqa: F401

    if not is_sqlite:
        try:
            with engine.begin() as connection:
                connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        except Exception:
            pass

    Base.metadata.create_all(bind=engine)
    if not is_sqlite:
        try:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS unit_id VARCHAR(40) DEFAULT 'U1204'"))
                connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"))
                connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100)"))
                connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)"))
        except Exception:
            pass
        try:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE volumetric_properties ADD COLUMN IF NOT EXISTS building_id INTEGER REFERENCES buildings(id)"))
        except Exception:
            pass
