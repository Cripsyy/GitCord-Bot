"""Schema migration: v2 — Repository-centric webhooks with subscription fan-out.
v3 — Per-subscription events & AI settings moved from config level to subscription level.

Run once during app startup. Converts the old per-guild webhook_configs model
into the new repo-centric WebhookConfig + WebhookSubscription split.
"""

import logging

from sqlalchemy import text
from sqlalchemy.engine import Engine

logger = logging.getLogger("migrations.v2")


def run_v2_webhook_subscriptions(engine: Engine) -> None:
    """Idempotent migration from v1 (per-guild webhook_configs) to v2/v3 (repo-centric + per-subscription settings)."""
    with engine.begin() as conn:
        _migrate_data(conn)
        _drop_legacy_columns(conn)
        _migrate_subscription_settings(conn)
        _drop_config_settings_columns(conn)


def _migrate_data(conn) -> None:
    dialect_name = conn.engine.dialect.name

    sub_table_exists = _table_exists(conn, "webhook_subscriptions")

    if sub_table_exists:
        has_data = conn.execute(text("SELECT COUNT(*) FROM webhook_subscriptions")).scalar()
        if has_data:
            logger.info("Migration v2 already applied (subscriptions table exists with data)")
            return

    has_guild_col = _column_exists(conn, "webhook_configs", "guild_id")

    if has_guild_col:
        logger.info("Running v2 migration: migrating webhook_configs to subscription model")

        if sub_table_exists:
            logger.info("Truncating empty webhook_subscriptions before re-migration")
            if dialect_name == "postgresql":
                conn.execute(text("TRUNCATE TABLE webhook_subscriptions RESTART IDENTITY CASCADE"))
            elif dialect_name == "sqlite":
                conn.execute(text("DELETE FROM webhook_subscriptions"))
            else:
                conn.execute(text("DELETE FROM webhook_subscriptions"))
        else:
            conn.execute(text("""
                CREATE TABLE webhook_subscriptions (
                    id BIGINT NOT NULL AUTO_INCREMENT,
                    webhook_config_id BIGINT NOT NULL,
                    guild_id VARCHAR(32) NOT NULL,
                    channel_id VARCHAR(32) NOT NULL,
                    PRIMARY KEY (id),
                    FOREIGN KEY (webhook_config_id) REFERENCES webhook_configs (id),
                    UNIQUE (webhook_config_id, guild_id, channel_id)
                )
            """))

        conn.execute(
            text("""
                INSERT INTO webhook_subscriptions (webhook_config_id, guild_id, channel_id)
                SELECT id, guild_id, channel_id FROM webhook_configs
                WHERE guild_id IS NOT NULL AND channel_id IS NOT NULL
            """)
        )

        migrated = conn.execute(text("SELECT COUNT(*) FROM webhook_subscriptions")).scalar()
        logger.info("Migrated %d subscriptions from webhook_configs", migrated)
    else:
        logger.info("Migration v2: guild_id column not present — no data to migrate")


def _drop_legacy_columns(conn) -> None:
    dialect_name = conn.engine.dialect.name

    if not _column_exists(conn, "webhook_configs", "guild_id"):
        return

    logger.info("Dropping legacy guild_id/channel_id columns from webhook_configs")

    if dialect_name == "sqlite":
        _sqlite_rebuild_webhook_configs(conn)
    elif dialect_name == "postgresql":
        conn.execute(text("ALTER TABLE webhook_configs DROP CONSTRAINT IF EXISTS uq_webhook_configs_guild_slug"))
        conn.execute(text("ALTER TABLE webhook_configs DROP COLUMN IF EXISTS guild_id"))
        conn.execute(text("ALTER TABLE webhook_configs DROP COLUMN IF EXISTS channel_id"))
        conn.execute(text("""
            ALTER TABLE webhook_configs ADD CONSTRAINT uq_webhook_configs_secret_slug
            UNIQUE (secret_slug)
        """))
    else:
        conn.execute(text("ALTER TABLE webhook_configs DROP COLUMN IF EXISTS guild_id"))
        conn.execute(text("ALTER TABLE webhook_configs DROP COLUMN IF EXISTS channel_id"))


def _migrate_subscription_settings(conn) -> None:
    """v3: Move events, ai_summary_enabled, ai_max_diff_chars from webhook_configs to webhook_subscriptions."""
    if not _column_exists(conn, "webhook_configs", "events"):
        logger.info("Migration v3: events column already removed from configs — skipping")
        return

    dialect_name = conn.engine.dialect.name

    if not _column_exists(conn, "webhook_subscriptions", "events"):
        logger.info("Adding events/AI columns to webhook_subscriptions")
        col_type = "JSON" if dialect_name == "postgresql" else "JSON"
        if dialect_name == "sqlite":
            col_type = "TEXT"
        elif dialect_name == "mysql":
            col_type = "JSON"

        conn.execute(text(f"ALTER TABLE webhook_subscriptions ADD COLUMN events {col_type}"))
        conn.execute(text("ALTER TABLE webhook_subscriptions ADD COLUMN ai_summary_enabled BOOLEAN NOT NULL DEFAULT TRUE"))
        conn.execute(text("ALTER TABLE webhook_subscriptions ADD COLUMN ai_max_diff_chars BIGINT NOT NULL DEFAULT 12000"))

    if _column_exists(conn, "webhook_configs", "events"):
        default_events = '["push", "pull_request", "issues"]'
        conn.execute(
            text("""
                UPDATE webhook_subscriptions
                SET
                    events = COALESCE(
                        (SELECT events FROM webhook_configs WHERE webhook_configs.id = webhook_subscriptions.webhook_config_id),
                        :de
                    ),
                    ai_summary_enabled = COALESCE(
                        (SELECT ai_summary_enabled FROM webhook_configs WHERE webhook_configs.id = webhook_subscriptions.webhook_config_id),
                        :aise
                    ),
                    ai_max_diff_chars = COALESCE(
                        (SELECT ai_max_diff_chars FROM webhook_configs WHERE webhook_configs.id = webhook_subscriptions.webhook_config_id),
                        :aimdc
                    )
            """),
            {"de": default_events, "aise": True, "aimdc": 12000},
        )
        logger.info("Migrated events/AI settings from webhook_configs to webhook_subscriptions")


def _drop_config_settings_columns(conn) -> None:
    """Drop events, ai_summary_enabled, ai_max_diff_chars from webhook_configs after migration."""
    dialect_name = conn.engine.dialect.name

    if not _column_exists(conn, "webhook_configs", "events"):
        return

    logger.info("Dropping events/AI columns from webhook_configs")

    if dialect_name == "sqlite":
        conn.execute(text("""
            CREATE TABLE webhook_configs_v3 (
                id BIGINT NOT NULL,
                secret_slug VARCHAR(64) NOT NULL,
                webhook_secret VARCHAR(255) NOT NULL,
                repository_full_name VARCHAR(255) NOT NULL,
                created_at TEXT,
                PRIMARY KEY (id),
                UNIQUE (secret_slug)
            )
        """))
        conn.execute(text("""
            INSERT INTO webhook_configs_v3 (id, secret_slug, webhook_secret, repository_full_name, created_at)
            SELECT id, secret_slug, webhook_secret, repository_full_name, created_at
            FROM webhook_configs
        """))
        conn.execute(text("DROP TABLE webhook_configs"))
        conn.execute(text("ALTER TABLE webhook_configs_v3 RENAME TO webhook_configs"))
    elif dialect_name == "postgresql":
        conn.execute(text("ALTER TABLE webhook_configs DROP COLUMN IF EXISTS events"))
        conn.execute(text("ALTER TABLE webhook_configs DROP COLUMN IF EXISTS ai_summary_enabled"))
        conn.execute(text("ALTER TABLE webhook_configs DROP COLUMN IF EXISTS ai_max_diff_chars"))
    else:
        conn.execute(text("ALTER TABLE webhook_configs DROP COLUMN IF EXISTS events"))
        conn.execute(text("ALTER TABLE webhook_configs DROP COLUMN IF EXISTS ai_summary_enabled"))
        conn.execute(text("ALTER TABLE webhook_configs DROP COLUMN IF EXISTS ai_max_diff_chars"))


def _sqlite_rebuild_webhook_configs(conn) -> None:
    conn.execute(text("""
        CREATE TABLE webhook_configs_v2 (
            id BIGINT NOT NULL,
            secret_slug VARCHAR(64) NOT NULL,
            webhook_secret VARCHAR(255) NOT NULL,
            repository_full_name VARCHAR(255) NOT NULL,
            ai_summary_enabled BOOLEAN NOT NULL DEFAULT 1,
            ai_max_diff_chars BIGINT NOT NULL DEFAULT 12000,
            events JSON NOT NULL DEFAULT '[]',
            created_at TEXT,
            PRIMARY KEY (id),
            UNIQUE (secret_slug)
        )
    """))
    conn.execute(text("""
        INSERT INTO webhook_configs_v2 (id, secret_slug, webhook_secret, repository_full_name,
                                        ai_summary_enabled, ai_max_diff_chars, events, created_at)
        SELECT id, secret_slug, webhook_secret, repository_full_name,
               COALESCE(ai_summary_enabled, 1), COALESCE(ai_max_diff_chars, 12000),
               COALESCE(events, '[]'), created_at
        FROM webhook_configs
    """))
    conn.execute(text("DROP TABLE webhook_configs"))
    conn.execute(text("ALTER TABLE webhook_configs_v2 RENAME TO webhook_configs"))


def _table_exists(conn, table_name: str) -> bool:
    dialect_name = conn.engine.dialect.name
    if dialect_name == "sqlite":
        result = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"),
            {"t": table_name},
        )
    elif dialect_name == "postgresql":
        result = conn.execute(
            text("SELECT tablename FROM pg_catalog.pg_tables WHERE tablename=:t"),
            {"t": table_name},
        )
    else:
        try:
            conn.execute(text(f"SELECT 1 FROM {table_name} LIMIT 0"))
            return True
        except Exception:
            return False
    return result.scalar() is not None


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    dialect_name = conn.engine.dialect.name
    if dialect_name == "sqlite":
        result = conn.execute(text(f"PRAGMA table_info({table_name})"))
        for row in result:
            if row[1] == column_name:
                return True
        return False
    elif dialect_name == "postgresql":
        result = conn.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name=:t AND column_name=:c"
            ),
            {"t": table_name, "c": column_name},
        )
    else:
        try:
            conn.execute(text(f"SELECT {column_name} FROM {table_name} LIMIT 0"))
            return True
        except Exception:
            return False
    return result.scalar() is not None
