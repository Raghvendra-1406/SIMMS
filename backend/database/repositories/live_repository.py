from database.connection import get_connection


# One round trip returns everything the live monitor needs for
# every room: latest reading per observation type, per-fan motion,
# node status, active faults and latest health score.
# Each lookup is a LIMIT 1 on an (…, observed_at DESC) index.
LIVE_ROOMS_SQL = """
SELECT json_build_object(
    'room_id', r.room_id,
    'room_name', r.room_name,
    'room_type', r.room_type,
    'building', r.building,
    'floor', r.floor,
    'capacity', r.capacity,
    'status', r.status,

    'sensors', (
        SELECT json_object_agg(
            t.observation_type,
            json_build_object(
                'data', o.observation_data,
                'observed_at', o.observed_at
            )
        )
        FROM unnest(ARRAY['ELECTRICAL', 'ENVIRONMENT', 'LIGHT'])
            AS t(observation_type)
        CROSS JOIN LATERAL (
            SELECT observation_data, observed_at
            FROM sensor_observations s
            WHERE s.room_id = r.room_id
              AND s.observation_type = t.observation_type
            ORDER BY s.observed_at DESC
            LIMIT 1
        ) o
    ),

    'vision', (
        SELECT json_object_agg(
            t.observation_type,
            json_build_object(
                'data', o.observation_data,
                'observed_at', o.observed_at
            )
        )
        FROM unnest(ARRAY['OCCUPANCY', 'BOARD'])
            AS t(observation_type)
        CROSS JOIN LATERAL (
            SELECT observation_data, observed_at
            FROM vision_observations v
            WHERE v.room_id = r.room_id
              AND v.observation_type = t.observation_type
            ORDER BY v.observed_at DESC
            LIMIT 1
        ) o
    ),

    'fans', COALESCE((
        SELECT json_agg(
            json_build_object(
                'device_id', d.device_id,
                'device_name', d.device_name,
                'status', d.status,
                'last_seen', d.last_seen,
                'data', f.observation_data,
                'observed_at', f.observed_at
            )
            ORDER BY d.device_id
        )
        FROM devices d
        LEFT JOIN LATERAL (
            SELECT observation_data, observed_at
            FROM vision_observations v
            WHERE v.device_id = d.device_id
              AND v.observation_type = 'FAN_MOTION'
            ORDER BY v.observed_at DESC
            LIMIT 1
        ) f ON TRUE
        WHERE d.room_id = r.room_id
          AND UPPER(d.device_type) = 'FAN'
    ), '[]'::json),

    'nodes', COALESCE((
        SELECT json_agg(
            json_build_object(
                'node_id', n.node_id,
                'kind', n.kind,
                'state', n.state,
                'rssi', n.rssi,
                'uptime_s', n.uptime_s,
                'fw_version', n.fw_version,
                'details', n.details,
                'last_seen', n.last_seen
            )
            ORDER BY n.node_id
        )
        FROM node_status n
        WHERE n.room_id = r.room_id
    ), '[]'::json),

    'active_faults', COALESCE((
        SELECT json_agg(
            json_build_object(
                'fault_id', fe.fault_id,
                'fault_type', fe.fault_type,
                'device_id', fe.device_id,
                'status', fe.status,
                'detected_at', fe.detected_at
            )
            ORDER BY fe.detected_at DESC
        )
        FROM fault_events fe
        WHERE fe.room_id = r.room_id
          AND fe.status IN ('OPEN', 'REOPENED')
    ), '[]'::json),

    'health', (
        SELECT json_build_object(
            'health_status', h.health_status,
            'health_score', h.health_score,
            'calculated_at', h.calculated_at
        )
        FROM health_scores h
        WHERE h.room_id = r.room_id
        ORDER BY h.calculated_at DESC
        LIMIT 1
    ),

    'server_time', CURRENT_TIMESTAMP
)
FROM rooms r
WHERE %(room_id)s::int IS NULL
   OR r.room_id = %(room_id)s::int
ORDER BY r.room_id
"""


def get_live_rooms(room_id=None):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            LIVE_ROOMS_SQL,
            {"room_id": room_id}
        )

        return [row[0] for row in cursor.fetchall()]

    finally:
        cursor.close()
        conn.close()
