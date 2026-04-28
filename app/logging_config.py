import logging
from typing import Any

from app.logging_handlers import DatabaseHandler


def configure_logging(
    level: str = "INFO",
    database_url: str | None = None,
) -> None:
    """Configure logging with optional database handler.
    
    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        database_url: PostgreSQL connection string for database logging
    """
    log_level = getattr(logging, level.upper(), logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    )

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)

    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers.clear()  # Clear any existing handlers
    root_logger.addHandler(console_handler)

    # Optional database handler
    if database_url:
        try:
            db_handler = DatabaseHandler(database_url)
            db_handler.setLevel(log_level)
            db_handler.setFormatter(formatter)
            root_logger.addHandler(db_handler)
            root_logger.info("Database logging initialized")
        except Exception as e:
            root_logger.warning(f"Failed to initialize database logging: {e}")
