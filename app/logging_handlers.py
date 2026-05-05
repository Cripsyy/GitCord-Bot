import logging
import queue
from threading import Thread

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.log import AppLog


class DatabaseHandler(logging.Handler):
    """Async logging handler that writes logs to PostgreSQL."""

    def __init__(self, database_url: str, batch_size: int = 10):
        super().__init__()
        self.database_url = database_url
        self.batch_size = batch_size
        self.queue: queue.Queue = queue.Queue()
        self.session_factory = sessionmaker(
            bind=create_engine(database_url, pool_pre_ping=True),
            autoflush=False,
            autocommit=False,
        )

        # Start background thread for batch processing
        self.worker_thread = Thread(target=self._worker, daemon=True)
        self.worker_thread.start()

    def emit(self, record: logging.LogRecord) -> None:
        """Add log record to queue."""
        try:
            self.queue.put_nowait(record)
        except queue.Full:
            self.handleError(record)

    def _worker(self) -> None:
        """Background worker that processes logs in batches."""
        batch = []
        while True:
            try:
                # Get record with timeout to process batches periodically
                record = self.queue.get(timeout=5)
                batch.append(record)

                # Process batch when it reaches size or timeout
                if len(batch) >= self.batch_size:
                    self._flush_batch(batch)
                    batch = []
            except queue.Empty:
                # Timeout - flush any remaining records
                if batch:
                    self._flush_batch(batch)
                    batch = []

    def _flush_batch(self, records: list[logging.LogRecord]) -> None:
        """Write batch of records to database."""
        session: Session | None = None
        try:
            session = self.session_factory()
            for record in records:
                log_entry = AppLog(
                    level=record.levelname,
                    logger_name=record.name,
                    message=self.format(record),
                )
                session.add(log_entry)
            session.commit()
        except Exception as e:
            print(f"Failed to write logs to database: {e}")
            if session:
                session.rollback()
        finally:
            if session:
                session.close()
