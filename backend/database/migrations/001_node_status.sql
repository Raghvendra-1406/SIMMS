-- Online/offline status of IoT nodes and cameras (Plan v2 §14.2).
-- Fed by retained MQTT status messages and last-will OFFLINE messages.
--
-- Apply to an existing database:
--     psql -d simms -f backend/database/migrations/001_node_status.sql

CREATE TABLE IF NOT EXISTS node_status (
    node_status_id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL
        REFERENCES rooms(room_id) ON DELETE CASCADE,
    node_id VARCHAR(64) NOT NULL,
    kind VARCHAR(30),
    state VARCHAR(20) NOT NULL,
    rssi INTEGER,
    uptime_s BIGINT,
    fw_version VARCHAR(30),
    details JSONB,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (room_id, node_id)
);
