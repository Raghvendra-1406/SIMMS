from database.connection import get_connection
from psycopg2.extras import Json


def create_ticket_evidence(
    ticket_id,
    evidence_type,
    evidence_data,
    evidence_stage
):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO ticket_evidence (
                ticket_id,
                evidence_type,
                evidence_data,
                evidence_stage
            )
            VALUES (%s, %s, %s, %s)
            RETURNING
                evidence_id,
                ticket_id,
                evidence_type,
                evidence_data,
                captured_at,
                evidence_stage
        """, (
            ticket_id,
            evidence_type,
            Json(evidence_data),
            evidence_stage
        ))

        evidence = cursor.fetchone()
        conn.commit()

        return evidence

    except Exception:
        conn.rollback()
        raise

    finally:
        cursor.close()
        conn.close()


def get_evidence_by_id(evidence_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                evidence_id,
                ticket_id,
                evidence_type,
                evidence_data,
                captured_at,
                evidence_stage
            FROM ticket_evidence
            WHERE evidence_id = %s
        """, (evidence_id,))

        return cursor.fetchone()

    finally:
        cursor.close()
        conn.close()


def get_ticket_evidence(ticket_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                evidence_id,
                ticket_id,
                evidence_type,
                evidence_data,
                captured_at,
                evidence_stage
            FROM ticket_evidence
            WHERE ticket_id = %s
            ORDER BY captured_at ASC, evidence_id ASC
        """, (ticket_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_detection_evidence(ticket_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                evidence_id,
                ticket_id,
                evidence_type,
                evidence_data,
                captured_at,
                evidence_stage
            FROM ticket_evidence
            WHERE ticket_id = %s
              AND evidence_stage = 'DETECTION'
            ORDER BY captured_at ASC, evidence_id ASC
        """, (ticket_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()


def get_verification_evidence(ticket_id):
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT
                evidence_id,
                ticket_id,
                evidence_type,
                evidence_data,
                captured_at,
                evidence_stage
            FROM ticket_evidence
            WHERE ticket_id = %s
              AND evidence_stage = 'VERIFICATION'
            ORDER BY captured_at ASC, evidence_id ASC
        """, (ticket_id,))

        return cursor.fetchall()

    finally:
        cursor.close()
        conn.close()