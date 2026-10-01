-- =========================================================
-- SIMMS database schema (PostgreSQL 16+)
--
-- Load into an empty database:
--     psql -d simms -f backend/database/schema.sql
--
-- All timestamps are TIMESTAMPTZ: the backend writes UTC times,
-- and TIMESTAMPTZ keeps them correct whatever the server or
-- session time zone is.
-- =========================================================


CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE rooms (
    room_id SERIAL PRIMARY KEY,
    room_name VARCHAR(20) NOT NULL UNIQUE,
    room_type VARCHAR(20) NOT NULL
        CHECK (room_type IN ('CLASSROOM', 'LAB')),
    building VARCHAR(100),
    floor INTEGER,
    capacity INTEGER,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE devices (
    device_id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(room_id),
    device_type VARCHAR(30) NOT NULL,
    device_name VARCHAR(100) NOT NULL,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fault_events (
    fault_id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(room_id),
    device_id INTEGER REFERENCES devices(device_id),
    fault_type VARCHAR(40) NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    confidence DECIMAL(5,2),
    abnormal_count INTEGER,
    recurrence_type VARCHAR(30),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
    ticket_id SERIAL PRIMARY KEY,
    fault_id INTEGER NOT NULL REFERENCES fault_events(fault_id),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    maintenance_notes TEXT,
    recurrence_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE ticket_history (
    history_id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(ticket_id),
    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    changed_by INTEGER REFERENCES users(user_id),
    note TEXT
);

CREATE TABLE ticket_evidence (
    evidence_id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(ticket_id),
    evidence_type VARCHAR(30) NOT NULL,
    evidence_data JSONB,
    captured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    evidence_stage VARCHAR(30) NOT NULL
);

CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    ticket_id INTEGER REFERENCES tickets(ticket_id),
    notification_type VARCHAR(40) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sensor_observations (
    observation_id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(room_id),
    device_id INTEGER REFERENCES devices(device_id),
    observed_at TIMESTAMPTZ NOT NULL,
    observation_type VARCHAR(40) NOT NULL,
    observation_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vision_observations (
    vision_observation_id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(room_id),
    device_id INTEGER REFERENCES devices(device_id),
    observed_at TIMESTAMPTZ NOT NULL,
    observation_type VARCHAR(40) NOT NULL,
    observation_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE health_scores (
    health_id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES rooms(room_id),
    health_status VARCHAR(20) NOT NULL,
    health_score DECIMAL(5,2),
    active_fault_count INTEGER DEFAULT 0,
    occupancy_count INTEGER DEFAULT 0,
    temperature DECIMAL(5,2),
    humidity DECIMAL(5,2),
    power DECIMAL(10,2),
    calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vision_calibrations (
    calibration_id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL
        REFERENCES rooms(room_id),
    calibration_version INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    calibration_data JSONB NOT NULL,
    created_by INTEGER NOT NULL
        REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE (room_id, calibration_version)
);


-- Online/offline status of IoT nodes and cameras.
CREATE TABLE node_status (
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


-- Calibration reference images (kept in the database: ephemeral disks).
CREATE TABLE calibration_images (
    image_id UUID PRIMARY KEY,
    content_type VARCHAR(40) NOT NULL,
    data BYTEA NOT NULL,
    created_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- INDEXES
-- =========================================================

-- Every MQTT message looks up the latest reading of a type
-- for a room (sensor and vision) or for a device (fan motion).
CREATE INDEX idx_sensor_obs_room_type_time
    ON sensor_observations (room_id, observation_type, observed_at DESC);

CREATE INDEX idx_vision_obs_room_type_time
    ON vision_observations (room_id, observation_type, observed_at DESC);

CREATE INDEX idx_vision_obs_device_type_time
    ON vision_observations (device_id, observation_type, observed_at DESC);

-- Active-fault lookup on every confirmed fault.
CREATE INDEX idx_fault_events_room_status
    ON fault_events (room_id, status);

CREATE INDEX idx_tickets_fault
    ON tickets (fault_id);

CREATE INDEX idx_ticket_history_ticket
    ON ticket_history (ticket_id);

CREATE INDEX idx_ticket_evidence_ticket
    ON ticket_evidence (ticket_id);

CREATE INDEX idx_notifications_user_read
    ON notifications (user_id, is_read);

CREATE INDEX idx_health_scores_room_time
    ON health_scores (room_id, calculated_at DESC);


-- =========================================================
-- CONSTRAINTS
-- =========================================================

-- At most one active ticket per fault, enforced by the database
-- and not only by application logic (Plan v2 §7.2 / §14.1).
CREATE UNIQUE INDEX uq_tickets_one_active_per_fault
    ON tickets (fault_id)
    WHERE status IN ('OPEN', 'REOPENED', 'RESOLVED');

-- At most one active calibration per room.
CREATE UNIQUE INDEX uq_vision_calibrations_one_active_per_room
    ON vision_calibrations (room_id)
    WHERE is_active;
