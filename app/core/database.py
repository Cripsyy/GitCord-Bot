from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.models import Base


def create_engine_from_settings(settings: Settings):
    return create_engine(settings.database_url, pool_pre_ping=True)


def create_session_factory(settings: Settings) -> sessionmaker[Session]:
    engine = create_engine_from_settings(settings)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_database(settings: Settings) -> None:
    engine = create_engine_from_settings(settings)
    Base.metadata.create_all(bind=engine)


def get_session(settings: Settings) -> Generator[Session, None, None]:
    session_factory = create_session_factory(settings)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
