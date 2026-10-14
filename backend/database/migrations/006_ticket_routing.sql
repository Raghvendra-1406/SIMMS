-- Plan v2 §9 / C7: route tickets by category to a staff team,
-- assign them, and track a response SLA with escalation.
--
-- users.team             staff team (ELECTRICAL / HOUSEKEEPING / GENERAL)
-- tickets.category       ELECTRICAL / CLEANING / ENERGY (from fault type)
-- tickets.assigned_to    current assignee (NULL = unassigned)
-- tickets.sla_started_at when the SLA clock started (created / reopened)
-- tickets.sla_due_at     response due by
-- tickets.started_at     staff started work (the SLA "response")
-- tickets.escalated_at   SLA breach already handled
--
-- Apply to an existing database:
--     psql -d simms -f backend/database/migrations/006_ticket_routing.sql

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS team VARCHAR(30);

ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS category VARCHAR(30),
    ADD COLUMN IF NOT EXISTS assigned_to INTEGER
        REFERENCES users(user_id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sla_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_active
    ON tickets (assigned_to)
    WHERE status IN ('OPEN', 'REOPENED', 'RESOLVED');

CREATE INDEX IF NOT EXISTS idx_tickets_sla_pending
    ON tickets (sla_due_at)
    WHERE status IN ('OPEN', 'REOPENED')
      AND started_at IS NULL
      AND escalated_at IS NULL;

-- Existing tickets: category from the fault type, SLA from creation.
UPDATE tickets t
SET category = CASE f.fault_type
        WHEN 'BOARD_NEEDS_CLEANING' THEN 'CLEANING'
        WHEN 'ENERGY_WASTAGE' THEN 'ENERGY'
        WHEN 'LIGHTS_LEFT_ON' THEN 'ENERGY'
        ELSE 'ELECTRICAL'
    END,
    sla_started_at = t.created_at,
    sla_due_at = t.created_at + CASE t.priority
        WHEN 'HIGH' THEN INTERVAL '2 hours'
        WHEN 'LOW' THEN INTERVAL '24 hours'
        ELSE INTERVAL '8 hours'
    END,
    -- Old tickets must not all escalate at once after the upgrade.
    escalated_at = CASE
        WHEN t.status IN ('OPEN', 'REOPENED') THEN CURRENT_TIMESTAMP
        ELSE NULL
    END
FROM fault_events f
WHERE f.fault_id = t.fault_id
  AND t.category IS NULL;
