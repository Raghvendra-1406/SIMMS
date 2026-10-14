import { useEffect, useState } from "react";
import Icon from "./Icon";
import { Alert, Card, DetailItem, Spinner } from "./ui";
import { AssigneeLabel, SlaBadge } from "./TicketRouting";
import { apiFetch } from "../lib/api";
import { CATEGORY_LABELS, TEAM_LABELS, formatRelative } from "../lib/ticketRouting";

const ACTIVE_STATUSES = new Set(["OPEN", "REOPENED", "RESOLVED"]);

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/**
 * Supervisor / admin card: who the ticket is routed to, its response
 * SLA, and a picker to reassign it (Plan v2 §9).
 */
export default function TicketAssignmentCard({ ticket, onUpdated }) {
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState(ticket.assigned_to ? String(ticket.assigned_to) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/tickets/staff")
      .then((data) => setStaff(Array.isArray(data) ? data : []))
      .catch(() => setStaff([]));
  }, []);

  const active = ACTIVE_STATUSES.has(ticket.status);
  const current = ticket.assigned_to ? String(ticket.assigned_to) : "";

  const save = async () => {
    setSaving(true);
    setError("");

    try {
      const updated = await apiFetch(`/tickets/${ticket.ticket_id}/assignee`, {
        method: "PUT",
        body: { user_id: selected ? Number(selected) : null },
      });
      onUpdated?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Assignment" subtitle="Routing and response time" icon="user" actions={<SlaBadge ticket={ticket} />}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <DetailItem label="Category">{CATEGORY_LABELS[ticket.category] || ticket.category || "—"}</DetailItem>
        <DetailItem label="Assigned to">
          <AssigneeLabel ticket={ticket} />
        </DetailItem>
        <DetailItem label="Respond by" mono>
          {ticket.sla_due_at ? (
            <>
              {formatDateTime(ticket.sla_due_at)}
              {!ticket.started_at && active && (
                <span className="block text-[11px] font-normal text-slate-500">{formatRelative(ticket.sla_due_at)}</span>
              )}
            </>
          ) : (
            "—"
          )}
        </DetailItem>
        <DetailItem label="Work started" mono>
          {formatDateTime(ticket.started_at)}
        </DetailItem>
      </dl>

      {ticket.escalated_at && !ticket.started_at && (
        <Alert tone="danger" title="Response time missed" className="mt-4">
          Escalated {formatDateTime(ticket.escalated_at)}. Reassign it or follow up with the assignee.
        </Alert>
      )}

      {active && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <label htmlFor="ticket-assignee" className="label">
            Reassign
          </label>
          <div className="mt-1.5 flex gap-2">
            <select
              id="ticket-assignee"
              className="select"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              disabled={saving}
            >
              <option value="">Unassigned</option>
              {staff.map((member) => (
                <option key={member.user_id} value={String(member.user_id)}>
                  {member.name}
                  {member.team ? ` · ${TEAM_LABELS[member.team] || member.team}` : ""} · {member.active_tickets} active
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary shrink-0"
              onClick={save}
              disabled={saving || selected === current}
            >
              {saving ? <Spinner /> : <Icon name="check" className="h-4 w-4" />}
              Save
            </button>
          </div>
          {staff.length === 0 && (
            <p className="help-text">No active maintenance staff. Add staff with a team on the Users page.</p>
          )}
          {error && (
            <Alert tone="danger" className="mt-3" onDismiss={() => setError("")}>
              {error}
            </Alert>
          )}
        </div>
      )}
    </Card>
  );
}
