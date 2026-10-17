"""Login, role guards and the statistics / review API."""

from services.fault_processing_service import handle_confirmed_fault


def test_login(client, users):
    ok = client.post("/auth/login", json={"email": "sup@example.com", "password": "password123"})
    assert ok.status_code == 200 and ok.json()["role"] == "SUPERVISOR"

    bad = client.post("/auth/login", json={"email": "sup@example.com", "password": "wrong-password"})
    assert bad.status_code == 401


def test_requests_without_a_token_are_rejected(client):
    assert client.get("/tickets/open").status_code in (401, 403)
    assert client.get("/stats/overview").status_code in (401, 403)


def test_role_guards(client, auth, users):
    staff = auth(users["electrician"])

    assert client.get("/users", headers=staff).status_code == 403
    assert client.get("/stats/overview", headers=staff).status_code == 403
    assert client.get("/tickets/staff", headers=staff).status_code == 403
    assert client.get("/users", headers=auth(users["admin"])).status_code == 200


def test_staff_get_their_own_notifications(client, auth, users):
    assert client.get("/notifications", headers=auth(users["electrician"])).status_code == 200
    assert client.get("/notifications", headers=auth(users["admin"])).status_code == 403


def test_user_team_validation(client, auth, users):
    admin = auth(users["admin"])
    base = {"name": "New", "email": "new@example.com", "password": "password123", "role": "MAINTENANCE_STAFF"}

    assert client.post("/users", headers=admin, json={**base, "team": "PLUMBING"}).status_code == 400

    created = client.post("/users", headers=admin, json={**base, "team": "HOUSEKEEPING"})
    assert created.status_code == 201 and created.json()["team"] == "HOUSEKEEPING"


def test_review_counts_towards_the_false_ticket_rate(client, auth, users, room):
    ticket_id = handle_confirmed_fault("BOARD_NEEDS_CLEANING", room["room_id"], None, 4)["ticket"][0]
    sup = auth(users["supervisor"])

    before = client.get("/stats/overview?days=1", headers=sup).json()["summary"]
    assert (before["tickets"], before["unreviewed"], before["false_alarms"]) == (1, 1, 0)

    assert client.put(f"/stats/tickets/{ticket_id}/review", headers=sup,
                      json={"verdict": "FALSE_ALARM"}).status_code == 200
    assert client.put(f"/stats/tickets/{ticket_id}/review", headers=sup,
                      json={"verdict": "MAYBE"}).status_code == 422

    after = client.get("/stats/overview?days=1", headers=sup).json()["summary"]
    assert (after["false_alarms"], after["unreviewed"]) == (1, 0)
    assert after["false_alarms_per_room_day"] > 0

    assert client.delete(f"/stats/tickets/{ticket_id}/review", headers=sup).status_code == 204
    assert client.delete(f"/stats/tickets/{ticket_id}/review", headers=sup).status_code == 404


def test_health_score_is_stored_with_its_breakdown(room, users, client, auth):
    from services.health_service import create_room_health_score

    handle_confirmed_fault("FAN_FAILURE", room["room_id"], room["devices"]["Fan 1"], 4)
    create_room_health_score(room["room_id"])

    rows = client.get("/health/classrooms", headers=auth(users["supervisor"])).json()
    health = next(r for r in rows if r["room_id"] == room["room_id"])

    assert health["health_status"] in {"NORMAL", "WARNING", "CRITICAL"}
    assert health["components"]["electrical"]["faulty_units"] == 1
