-- Plan v2 §7.2 / §9.2: count fault recurrences per ticket
-- (priority escalates after repeated recurrences).
-- AUTO_RESOLVED is a closed ticket status and needs no schema change;
-- the partial unique index only covers OPEN / REOPENED / RESOLVED.
--
-- Apply to an existing database:
--     psql -d simms -f backend/database/migrations/002_ticket_reliability.sql

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS recurrence_count INTEGER NOT NULL DEFAULT 0;
