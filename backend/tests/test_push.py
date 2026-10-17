"""Web Push (Plan v2 C8, T16) against a local fake push service."""

import base64
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

import http_ece
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from database.repositories.push_repository import get_user_subscriptions, upsert_subscription
from scripts.generate_vapid_keys import generate
from services import push_service


def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


@pytest.fixture
def push_server():
    received = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = self.rfile.read(int(self.headers["Content-Length"]))
            received.append((self.path, {k.lower(): v for k, v in self.headers.items()}, body))
            self.send_response(410 if self.path == "/gone" else 201)
            self.end_headers()

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    yield f"http://127.0.0.1:{server.server_address[1]}", received

    server.shutdown()


@pytest.fixture
def vapid(monkeypatch):
    public, private = generate()
    monkeypatch.setattr(push_service, "VAPID_PUBLIC_KEY", public)
    monkeypatch.setattr(push_service, "VAPID_PRIVATE_KEY", private)


@pytest.fixture
def browser():
    key = ec.generate_private_key(ec.SECP256R1())
    public = key.public_key().public_bytes(serialization.Encoding.X962,
                                          serialization.PublicFormat.UncompressedPoint)
    return key, b64(public), os.urandom(16)


def decrypt(body, browser):
    key, _, secret = browser
    return json.loads(http_ece.decrypt(body, private_key=key, auth_secret=secret, version="aes128gcm"))


def test_push_is_off_without_keys(users):
    assert not push_service.is_configured()
    assert push_service.send_to_user(users["supervisor"]["user_id"], "TEST", "x") == 0


def test_delivery_encryption_and_cleanup(users, vapid, push_server, browser):
    base, received = push_server
    _, p256dh, secret = browser
    user_id = users["supervisor"]["user_id"]

    upsert_subscription(user_id, f"{base}/ok", p256dh, b64(secret))
    upsert_subscription(user_id, f"{base}/gone", p256dh, b64(secret))

    assert push_service.send_to_user(user_id, "SLA_BREACHED", "Ticket #6 missed its SLA", ticket_id=6) == 1

    _, headers, body = next(r for r in received if r[0] == "/ok")
    assert headers["authorization"].startswith("vapid t=")
    assert headers["content-encoding"] == "aes128gcm"
    assert headers["urgency"] == "high"
    assert headers["ttl"] == str(12 * 3600)

    payload = decrypt(body, browser)
    assert payload["title"] == "Response time missed"
    assert payload["url"] == "/supervisor/tickets/6" and payload["tag"] == "ticket-6"

    endpoints = {s["endpoint"] for s in get_user_subscriptions(user_id)}
    assert endpoints == {f"{base}/ok"}, "the 410 subscription is removed"


def test_staff_links_open_the_maintenance_ticket(users, vapid, push_server, browser):
    base, received = push_server
    _, p256dh, secret = browser
    upsert_subscription(users["electrician"]["user_id"], f"{base}/ok", p256dh, b64(secret))

    push_service.queue_push(users["electrician"]["user_id"], "TICKET_ASSIGNED", "Fan 3", ticket_id=9)

    for _ in range(50):
        if received:
            break
        time.sleep(0.1)

    assert decrypt(received[0][2], browser)["url"] == "/maintenance/tickets/9"


def test_subscription_api(client, auth, users, vapid):
    headers = auth(users["supervisor"])
    subscription = {"endpoint": "https://push.example.com/abc", "keys": {"p256dh": "k" * 20, "auth": "a" * 10}}

    assert client.get("/push/config", headers=headers).json()["enabled"] is True
    assert client.post("/push/subscriptions", headers=headers, json=subscription).status_code == 201
    assert client.post("/push/subscriptions", headers=headers,
                       json={**subscription, "endpoint": "http://insecure.example.com/x"}).status_code == 400
    assert client.get("/push/config", headers=headers).json()["subscriptions"] == 1

    assert client.request("DELETE", "/push/subscriptions", headers=headers,
                          json={"endpoint": subscription["endpoint"]}).status_code == 204
    assert client.get("/push/config", headers=headers).json()["subscriptions"] == 0
