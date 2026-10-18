-- Plan v2 §12 / C8, T16: Web Push. One row per browser / installed app
-- that allowed notifications. The endpoint is unique per browser.
--
-- Apply to an existing database:
--     psql -d simms -f backend/database/migrations/007_push_subscriptions.sql

CREATE TABLE IF NOT EXISTS push_subscriptions (
    subscription_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL
        REFERENCES users(user_id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_success_at TIMESTAMPTZ,
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions (user_id);
