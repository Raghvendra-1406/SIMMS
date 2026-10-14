-- Circuit-level electrical monitoring.
--
-- circuit_baselines: per-unit current learned per room and circuit
--   (e.g. one fan draws 0.30 A), used to derive how many units on a
--   circuit are powered from the circuit's total current.
-- fault_events.details: what the detector saw when it confirmed the
--   fault (e.g. "6 fans powered, 5 rotating, Fan 3 stopped").
--
-- Apply to an existing database:
--     psql -d simms -f backend/database/migrations/003_circuit_monitoring.sql

CREATE TABLE IF NOT EXISTS circuit_baselines (
    circuit_baseline_id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL
        REFERENCES rooms(room_id) ON DELETE CASCADE,
    circuit VARCHAR(20) NOT NULL
        CHECK (circuit IN ('LIGHTS', 'FANS')),
    unit_current_a DECIMAL(8,3) NOT NULL,
    standby_current_a DECIMAL(8,3) NOT NULL DEFAULT 0,
    learned_units INTEGER,
    learned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (room_id, circuit)
);

ALTER TABLE fault_events
    ADD COLUMN IF NOT EXISTS details JSONB;
