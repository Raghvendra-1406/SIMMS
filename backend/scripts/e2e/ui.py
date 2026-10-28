"""
Browser pass over the whole dashboard (headless Chrome via Playwright),
called by run.py --ui against the running end-to-end stack.

For every role: log in through the real form, open every page and a
detail page of each kind, and fail on uncaught exceptions, console
errors, failed API calls or missing key content. Also exercises Start
work, the false-alarm review, the Team field, dark mode, a phone-width
layout and access control. Screenshots go to .run/shots/.

Needs: pip install playwright  (uses your installed Chrome; without it
run `python -m playwright install chromium` once).
"""

import json
import re
import time
import urllib.request

from playwright.sync_api import sync_playwright

UI = ""
API = ""
SHOTS = None
DOMAIN = "simms-e2e.example.com"

check = None

USERS = {
    "admin": f"admin@{DOMAIN}",
    "supervisor": f"supervisor@{DOMAIN}",
    "electrician": f"electrician@{DOMAIN}",
    "housekeeper": f"housekeeping@{DOMAIN}",
}

def api(path, who_token, method="GET", body=None):
    req = urllib.request.Request(API + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Authorization", "Bearer " + who_token)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read() or b"null")


def token(email):
    req = urllib.request.Request(API + "/auth/login", method="POST",
                                 data=json.dumps({"email": email, "password": "password123"}).encode())
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())["access_token"]


class Session:
    def __init__(self, browser, role, viewport=None):
        self.role = role
        self.context = browser.new_context(viewport=viewport or {"width": 1440, "height": 900})
        self.page = self.context.new_page()
        self.console_errors = []
        self.page_errors = []
        self.failed = []
        self.page.on("console", lambda m: m.type == "error" and self.console_errors.append(m.text))
        self.page.on("pageerror", lambda e: self.page_errors.append(str(e)))
        self.page.on("response", self._response)

    def _response(self, response):
        if response.url.startswith(API) and response.status >= 400:
            self.failed.append(f"{response.status} {response.request.method} {response.url[len(API):]}")

    def reset(self):
        self.console_errors.clear()
        self.page_errors.clear()
        self.failed.clear()

    def login(self):
        page = self.page
        page.goto(UI + "/")
        page.fill('input[type="email"]', USERS[self.role])
        page.fill('input[autocomplete="current-password"], input[type="password"]', "password123")
        page.click('button[type="submit"]')
        page.wait_for_url(re.compile(r".*/(admin|supervisor|maintenance)/dashboard"), timeout=15000)

    def visit(self, path, name, expect_text=None, settle=3000):
        self.reset()
        self.page.goto(UI + path)

        # Pages load in several requests: wait for the content, not a fixed time.
        if expect_text:
            try:
                self.page.get_by_text(re.compile(expect_text, re.I)).first.wait_for(timeout=15000)
            except Exception:
                pass

        self.page.wait_for_timeout(settle)
        body = self.page.inner_text("body")
        self.page.screenshot(path=str(SHOTS / f"{self.role}_{name}.png"), full_page=True)

        problems = []
        if self.page_errors:
            problems.append(f"uncaught: {self.page_errors[:2]}")
        noisy = [e for e in self.console_errors if "favicon" not in e and "ResizeObserver" not in e]
        if noisy:
            problems.append(f"console: {noisy[:2]}")
        if self.failed:
            problems.append(f"api: {self.failed[:3]}")
        if len(body.strip()) < 40:
            problems.append("page looks empty")
        if expect_text and not re.search(expect_text, body, re.I):
            problems.append(f"missing text /{expect_text}/")

        check(f"{self.role}: {path}", not problems, "; ".join(problems))
        return body


def launch(pw):
    try:
        return pw.chromium.launch(channel="chrome", headless=True)
    except Exception:
        # No Chrome installed: Playwright's own Chromium
        # (python -m playwright install chromium).
        return pw.chromium.launch(headless=True)


def run(check_fn, ui_url, api_url, shots):
    global UI, API, SHOTS, check

    UI, API, SHOTS, check = ui_url, api_url, shots, check_fn
    SHOTS.mkdir(parents=True, exist_ok=True)

    tokens = {role: token(email) for role, email in USERS.items()}
    sup = tokens["supervisor"]

    # Wait for the live node's Fan 2 fault so pages show a real open fault.
    for _ in range(60):
        live = api("/live/rooms", sup)["rooms"][0]
        if any(f.get("fault_type") == "FAN_FAILURE" for f in live.get("active_faults") or []):
            break
        time.sleep(2)
    check("live Fan 2 fault confirmed before the UI pass",
          any(f.get("fault_type") == "FAN_FAILURE" for f in live.get("active_faults") or []))

    tickets = api("/tickets", sup)
    rooms = api("/classrooms", sup)
    room_id = rooms[0]["room_id"]
    ticket_id = tickets[0]["ticket_id"]
    fault_id = tickets[0]["fault_id"]

    with sync_playwright() as pw:
        browser = launch(pw)

        print("\n== Admin")
        s = Session(browser, "admin")
        s.login()
        check("admin login lands on the dashboard", "/admin/dashboard" in s.page.url, s.page.url)
        s.visit("/admin/dashboard", "dashboard", "Normal|Warning|Critical")
        s.visit("/admin/monitoring", "monitoring", "R101")
        s.visit("/admin/statistics", "statistics", "False tickets")
        s.visit("/admin/rooms", "rooms", "R101")
        s.visit(f"/admin/rooms/{room_id}", "room_details", "Circuits|Fan")
        s.visit("/admin/devices", "devices", "Fan 1")
        s.visit("/admin/calibration", "calibration", "Calibration|calibrat")
        body = s.visit("/admin/users", "users", "Housekeeping|Electrical")
        # Team field appears for maintenance staff in the edit form.
        try:
            row = s.page.locator("tr", has_text="Ravi (Electrical)").first
            row.get_by_role("button", name=re.compile("edit", re.I)).first.click()
            s.page.wait_for_timeout(800)
            team = s.page.locator("#user-team")
            check("users: edit form shows Team for staff", team.count() == 1 and team.input_value() == "ELECTRICAL",
                  team.input_value() if team.count() else "no team field")
            s.page.keyboard.press("Escape")
        except Exception as exc:
            check("users: edit form shows Team for staff", False, repr(exc)[:150])
        s.context.close()

        print("\n== Supervisor")
        s = Session(browser, "supervisor")
        s.login()
        s.visit("/supervisor/dashboard", "dashboard")
        s.visit("/supervisor/classrooms", "classrooms", "R101")
        s.visit(f"/supervisor/classrooms/{room_id}", "classroom_details", "Fans and lights|Open tickets")
        body = s.visit("/supervisor/monitoring", "monitoring", "Fan 2")
        check("live monitor shows the blocked fan's ticket / failure", re.search(r"Fan 2", body) is not None)
        s.visit("/supervisor/faults", "faults", "Device offline|Fan failure|Electrical")
        s.visit(f"/supervisor/faults/{fault_id}", "fault_details")
        s.visit("/supervisor/tickets", "tickets", "Assigned to")
        s.visit(f"/supervisor/tickets/{ticket_id}", "ticket_details", "Assignment")
        s.visit("/supervisor/notifications", "notifications", "Phone notifications")
        body = s.visit("/supervisor/statistics", "statistics", "Energy wasted")
        check("statistics: energy section rendered", "kWh" in body)
        # Review a ticket as a false alarm from the review list.
        try:
            s.page.get_by_role("tab", name=re.compile("^All")).click()
            s.page.wait_for_timeout(500)
            s.page.get_by_role("button", name="False alarm").first.click()
            s.page.wait_for_timeout(2500)
            pressed = s.page.locator('button[aria-pressed="true"]', has_text="False alarm").count()
            check("statistics: mark a ticket as false alarm", pressed >= 1, f"pressed={pressed}")
        except Exception as exc:
            check("statistics: mark a ticket as false alarm", False, repr(exc)[:150])

        # Dark mode on the live monitor.
        try:
            s.page.goto(UI + "/supervisor/monitoring")
            s.page.wait_for_timeout(2000)
            s.page.evaluate("""() => { localStorage.setItem('simms.theme', 'dark'); }""")
            s.page.reload()
            s.page.wait_for_timeout(2500)
            theme = s.page.evaluate("document.documentElement.getAttribute('data-theme')")
            s.page.screenshot(path=str(SHOTS / "supervisor_monitoring_dark.png"), full_page=True)
            check("dark mode applies", theme == "dark", theme)
            s.page.evaluate("() => localStorage.setItem('simms.theme', 'light')")
        except Exception as exc:
            check("dark mode applies", False, repr(exc)[:150])
        s.context.close()

        print("\n== Maintenance (electrician)")
        s = Session(browser, "electrician")
        s.login()
        s.visit("/maintenance/dashboard", "dashboard")
        body = s.visit("/maintenance/tickets", "tickets", "Response")
        mine = api("/tickets/open?mine=true", tokens["electrician"])
        startable = [t for t in mine if t["status"] in ("OPEN", "REOPENED") and not t["started_at"]
                     and t["assigned_to"] is not None]
        if startable:
            target = startable[0]["ticket_id"]
            s.visit(f"/maintenance/tickets/{target}", "ticket_details", "Start work")
            try:
                s.page.get_by_role("button", name=re.compile("Start work")).first.click()
                s.page.wait_for_timeout(2500)
                started = api(f"/tickets/{target}", tokens["electrician"])["started_at"]
                check("staff: Start work recorded", bool(started))
            except Exception as exc:
                check("staff: Start work recorded", False, repr(exc)[:150])
        else:
            check("staff: a ticket to start exists", False, f"mine={[(t['ticket_id'], t['status']) for t in mine]}")
        s.visit("/maintenance/notifications", "notifications", "Phone notifications")
        s.context.close()

        print("\n== Maintenance on a phone (390 px)")
        s = Session(browser, "housekeeper", viewport={"width": 390, "height": 844})
        s.login()
        for path, name in [("/maintenance/dashboard", "m_dashboard"), ("/maintenance/tickets", "m_tickets")]:
            s.visit(path, name)
            overflow = s.page.evaluate("document.scrollingElement.scrollWidth - window.innerWidth")
            check(f"phone: no sideways scroll on {path}", overflow <= 1, f"{overflow}px")
        s.context.close()

        print("\n== Access control in the browser")
        s = Session(browser, "electrician")
        s.login()
        s.page.goto(UI + "/admin/users")
        s.page.wait_for_timeout(1500)
        check("staff cannot open admin pages", "Manage users" not in s.page.inner_text("body")
              and "/admin/users" not in s.page.url or "Ravi" not in s.page.inner_text("body"), s.page.url)
        s.context.close()

        browser.close()
