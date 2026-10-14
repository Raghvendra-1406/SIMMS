-- Plan v2 §16.2: the false ticket rate needs a human verdict per
-- ticket (genuine fault or false alarm). Kept in its own table so
-- the ticket workflow is untouched; one review per ticket.
--
-- Apply to an existing database:
--     psql -d simms -f backend/database/migrations/005_ticket_reviews.sql

CREATE TABLE IF NOT EXISTS ticket_reviews (
    ticket_id INTEGER PRIMARY KEY
        REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    verdict VARCHAR(20) NOT NULL
        CHECK (verdict IN ('GENUINE', 'FALSE_ALARM')),
    note TEXT,
    reviewed_by INTEGER REFERENCES users(user_id),
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_created
    ON tickets (created_at);
