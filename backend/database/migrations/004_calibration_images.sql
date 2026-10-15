-- Calibration reference images stored in the database, so they
-- survive on hosts with an ephemeral disk (Render, containers).
--
-- Apply to an existing database:
--     psql -d simms -f backend/database/migrations/004_calibration_images.sql

CREATE TABLE IF NOT EXISTS calibration_images (
    image_id UUID PRIMARY KEY,
    content_type VARCHAR(40) NOT NULL,
    data BYTEA NOT NULL,
    created_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
