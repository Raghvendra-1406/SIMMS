-- Plan v2 §10: store the CIHS breakdown (penalty per component) with
-- each health score, so the dashboard can show why a room scored low.
--
-- Apply to an existing database:
--     psql -d simms -f backend/database/migrations/008_health_components.sql

ALTER TABLE health_scores
    ADD COLUMN IF NOT EXISTS components JSONB;
