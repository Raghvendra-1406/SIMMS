"""Ticket routing, assignment and response SLA (Plan v2 §9, C7)."""

import pytest

from services.fault_processing_service import handle_confirmed_fault
from services.routing_service import check_sla_breaches


@pytest.fixture
def fan_ticket(room, users):
    result = handle_confirmed_fault("FAN_FAILURE", room["room_id"], room["devices"]["Fan 1"], 4,
                                    details={"summary": "test"})
    return result["ticket"][0]


@pytest.fixture
def board_ticket(room, users):
    return handle_confirmed_fault("BOARD_NEEDS_CLEANING", room["room_id"], None, 4)["ticket"][0]


def get(client, auth, user, ticket_id):
    return client.get(f"/tickets/{ticket_id}", headers=auth(user)).json()


def test_routing_by_category(client, auth, users, fan_ticket, board_ticket):
    fan = get(client, auth, users["supervisor"], fan_ticket)
    board = get(client, auth, users["supervisor"], board_ticket)

    assert (fan["category"], fan["assigned_to"]) == ("ELECTRICAL", users["electrician"]["user_id"])
    assert (board["category"], board["assigned_to"]) == ("CLEANING", users["housekeeper"]["user_id"])
    assert fan["sla_state"] == "ON_TRACK" and fan["sla_due_at"]


def test_assignee_is_notified(sql, users, fan_ticket):
    rows = sql("select notification_type from notifications where user_id = %s and ticket_id = %s",
               (users["electrician"]["user_id"], fan_ticket))
    assert ("TICKET_ASSIGNED",) in rows


def test_least_loaded_member_of_the_team_gets_the_next_ticket(room, users, fan_ticket):
    from database.repositories.ticket_routing_repository import get_ticket_routing, set_user_team
    from services.auth_service import register_user

    second = register_user(name="Second", email="second@example.com", password="password123",
                           role="MAINTENANCE_STAFF")
    set_user_team(second[0], "ELECTRICAL")

    ticket = handle_confirmed_fault("FAN_FAILURE", room["room_id"], room["devices"]["Fan 2"], 4)["ticket"]
    assert get_ticket_routing([ticket[0]])[ticket[0]]["assigned_to"] == second[0]


def test_staff_can_only_act_on_their_own_or_unassigned_tickets(client, auth, users, fan_ticket, board_ticket):
    house = auth(users["housekeeper"])

    assert client.post(f"/tickets/{fan_ticket}/start", headers=house).status_code == 403
    assert client.patch(f"/tickets/{fan_ticket}/status", headers=house,
                        json={"status": "RESOLVED"}).status_code == 403

    mine = {t["ticket_id"] for t in client.get("/tickets/open?mine=true", headers=house).json()}
    assert mine == {board_ticket}


def test_only_supervisors_reassign_and_only_to_staff(client, auth, users, fan_ticket):
    url = f"/tickets/{fan_ticket}/assignee"
    sup = auth(users["supervisor"])

    assert client.put(url, headers=auth(users["electrician"]),
                      json={"user_id": users["electrician"]["user_id"]}).status_code == 403
    assert client.put(url, headers=sup, json={"user_id": users["supervisor"]["user_id"]}).status_code == 400

    response = client.put(url, headers=sup, json={"user_id": users["housekeeper"]["user_id"]})
    assert response.status_code == 200 and response.json()["assigned_to"] == users["housekeeper"]["user_id"]


def test_unassigned_ticket_is_claimed_on_start(client, auth, users, fan_ticket):
    client.put(f"/tickets/{fan_ticket}/assignee", headers=auth(users["supervisor"]), json={"user_id": None})

    response = client.post(f"/tickets/{fan_ticket}/start", headers=auth(users["housekeeper"]))
    assert response.status_code == 200 and response.json()["assigned_to"] == users["housekeeper"]["user_id"]
    assert client.post(f"/tickets/{fan_ticket}/start", headers=auth(users["housekeeper"])).status_code == 400


def test_sla_breach_escalates_once(client, auth, sql, users, fan_ticket):
    sql("update tickets set sla_due_at = now() - interval '1 minute' where ticket_id = %s", (fan_ticket,))

    assert get(client, auth, users["supervisor"], fan_ticket)["sla_state"] == "OVERDUE"
    assert check_sla_breaches() == [fan_ticket]
    assert check_sla_breaches() == []

    notified = {r[0] for r in sql(
        "select user_id from notifications where ticket_id = %s and notification_type = 'SLA_BREACHED'",
        (fan_ticket,))}
    assert {users["supervisor"]["user_id"], users["electrician"]["user_id"]} <= notified

    started = client.post(f"/tickets/{fan_ticket}/start", headers=auth(users["electrician"])).json()
    assert started["sla_state"] == "LATE"


def test_low_priority_breach_is_flagged_without_notifications(sql, board_ticket):
    sql("update tickets set sla_due_at = now() - interval '1 minute' where ticket_id = %s", (board_ticket,))

    assert check_sla_breaches() == [board_ticket]
    assert sql("select count(*) from notifications where notification_type = 'SLA_BREACHED'")[0][0] == 0


def test_reopen_restarts_the_sla(client, auth, users, fan_ticket):
    elec = auth(users["electrician"])
    client.post(f"/tickets/{fan_ticket}/start", headers=elec)
    client.patch(f"/tickets/{fan_ticket}/status", headers=elec, json={"status": "RESOLVED"})

    reopened = client.patch(f"/tickets/{fan_ticket}/status", headers=auth(users["supervisor"]),
                            json={"status": "REOPENED"}).json()

    assert reopened["started_at"] is None and reopened["sla_state"] == "ON_TRACK"


def test_priority_change_moves_the_due_time(client, auth, users, fan_ticket):
    before = get(client, auth, users["supervisor"], fan_ticket)["sla_due_at"]

    after = client.patch(f"/tickets/{fan_ticket}/priority", headers=auth(users["supervisor"]),
                         json={"priority": "LOW"}).json()["sla_due_at"]

    assert after > before


def test_staff_cannot_close_tickets(client, auth, users, fan_ticket):
    elec = auth(users["electrician"])
    client.patch(f"/tickets/{fan_ticket}/status", headers=elec, json={"status": "RESOLVED"})

    assert client.patch(f"/tickets/{fan_ticket}/status", headers=elec,
                        json={"status": "CLOSED"}).status_code == 403
