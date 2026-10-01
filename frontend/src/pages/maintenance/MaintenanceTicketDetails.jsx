import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  DetailItem,
  EmptyState,
  RefreshButton,
  Spinner,
  StatusBadge,
} from "../../components/ui";
import { navigateTo } from "../../lib/session";
import { formatConfidence } from "../../lib/format";

const API_BASE_URL = "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export default function MaintenanceTicketDetails() {
  const [ticket, setTicket] = useState(null);
  const [fault, setFault] = useState(null);
  const [classroom, setClassroom] = useState(null);
  const [history, setHistory] = useState([]);

  const [maintenanceNotes, setMaintenanceNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const ticketId = Number(
    window.location.pathname.split("/").filter(Boolean).pop()
  );

  const validTicketId = Boolean(ticketId) && !Number.isNaN(ticketId);

  useEffect(() => {
    if (!ticketId || Number.isNaN(ticketId)) {
      setError("Invalid ticket ID.");
      setLoading(false);
      return;
    }

    loadTicketDetails();
  }, [ticketId]);

  async function loadTicketDetails() {
    try {
      setLoading(true);
      setError("");

      const headers = getAuthHeaders();

      const ticketResponse = await fetch(
        `${API_BASE_URL}/tickets/${ticketId}`,
        {
          headers,
        }
      );

      if (!ticketResponse.ok) {
        const data = await ticketResponse.json().catch(() => ({}));

        throw new Error(
          data.detail || "Failed to load ticket details."
        );
      }

      const ticketData = await ticketResponse.json();

      setTicket(ticketData);
      setMaintenanceNotes(ticketData.maintenance_notes || "");

      const requests = [];

      if (ticketData.fault_id) {
        requests.push(
          fetch(
            `${API_BASE_URL}/faults/${ticketData.fault_id}`,
            {
              headers,
            }
          ).then(async (response) => {
            if (!response.ok) {
              return null;
            }

            return response.json();
          })
        );
      } else {
        requests.push(Promise.resolve(null));
      }

      requests.push(
        fetch(
          `${API_BASE_URL}/ticket-history/ticket/${ticketId}`,
          {
            headers,
          }
        ).then(async (response) => {
          if (!response.ok) {
            return [];
          }

          return response.json();
        })
      );

      const [faultData, historyData] = await Promise.all(requests);

      setFault(faultData);
      setHistory(Array.isArray(historyData) ? historyData : []);

      if (faultData?.room_id) {
        const classroomResponse = await fetch(
          `${API_BASE_URL}/classrooms/${faultData.room_id}`,
          {
            headers,
          }
        );

        if (classroomResponse.ok) {
          const classroomData = await classroomResponse.json();
          setClassroom(classroomData);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load ticket details.");
    } finally {
      setLoading(false);
    }
  }

  async function updateTicketStatus(newStatus) {
    if (!ticket) {
      return;
    }

    if (ticket.status === "CLOSED") {
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");
      setSuccessMessage("");

      const response = await fetch(
        `${API_BASE_URL}/tickets/${ticket.ticket_id}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            status: newStatus,
            maintenance_notes: maintenanceNotes,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to update ticket status."
        );
      }

      setTicket(data);
      setMaintenanceNotes(data.maintenance_notes || "");

      setSuccessMessage(
        `Ticket status changed to ${formatStatus(newStatus)}.`
      );

      await loadTicketDetails();
    } catch (err) {
      setActionError(
        err.message || "Failed to update ticket status."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function saveMaintenanceNotes() {
    if (!ticket || ticket.status === "CLOSED") {
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");
      setSuccessMessage("");

      const response = await fetch(
        `${API_BASE_URL}/tickets/${ticket.ticket_id}/notes`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            maintenance_notes: maintenanceNotes,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to save maintenance notes."
        );
      }

      setTicket(data);
      setMaintenanceNotes(data.maintenance_notes || "");

      setSuccessMessage("Maintenance notes saved.");
    } catch (err) {
      setActionError(
        err.message || "Failed to save maintenance notes."
      );
    } finally {
      setActionLoading(false);
    }
  }

  function runAction(key, action) {
    setPendingAction(key);
    action();
  }

  const shellTitle = ticket?.ticket_id
    ? `Ticket #${ticket.ticket_id}`
    : validTicketId
    ? `Ticket #${ticketId}`
    : "Ticket details";

  const renderShell = (children) => (
    <AppShell
      backHref="/maintenance/tickets"
      eyebrow="My tickets"
      title={shellTitle}
      actions={
        validTicketId && (
          <RefreshButton onClick={loadTicketDetails} loading={loading} />
        )
      }
    >
      {children}
    </AppShell>
  );

  if (loading) {
    return renderShell(<PageLoading />);
  }

  if (error) {
    return renderShell(
      <Alert
        tone="danger"
        title="Unable to load ticket"
        onRetry={validTicketId ? loadTicketDetails : undefined}
      >
        <p>{error}</p>
        <button
          type="button"
          onClick={() => navigateTo("/maintenance/tickets")}
          className="btn btn-sm btn-secondary mt-3"
        >
          <Icon name="arrowLeft" className="h-3.5 w-3.5" />
          Back to tickets
        </button>
      </Alert>
    );
  }

  if (!ticket) {
    return renderShell(
      <div className="card">
        <EmptyState
          icon="ticket"
          title="Ticket not found."
          description="The ticket may have been removed or you may not have access to it."
          action={
            <button
              type="button"
              onClick={() => navigateTo("/maintenance/tickets")}
              className="btn btn-secondary"
            >
              <Icon name="arrowLeft" className="h-4 w-4" />
              Back to tickets
            </button>
          }
        />
      </div>
    );
  }

  const isClosed = ticket.status === "CLOSED";
  const canResolve =
    ticket.status === "OPEN" ||
    ticket.status === "REOPENED";

  const canClose = ticket.status === "RESOLVED";

  const locationParts = [
    classroom?.building,
    classroom?.floor !== null && classroom?.floor !== undefined && classroom?.floor !== ""
      ? `Floor ${classroom.floor}`
      : null,
  ].filter(Boolean);

  const busyLabel = (key, idle) =>
    actionLoading && pendingAction === key ? "Updating…" : idle;

  return renderShell(
    <>
      {/* SUMMARY + ACTIONS */}
      <section className="card overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="num text-xs font-medium text-slate-500">
              Ticket #{ticket.ticket_id}
            </span>
            <StatusBadge status={ticket.status} label={formatStatus(ticket.status)} />
            {ticket.priority && (
              <StatusBadge
                status={ticket.priority}
                tone={ticket.priority === "CRITICAL" ? "danger" : undefined}
                label={`${formatPriority(ticket.priority)} priority`}
              />
            )}
          </div>

          <h2 className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {fault ? formatFaultType(fault.fault_type) : "Maintenance ticket"}
          </h2>

          {(classroom || fault) && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-600">
              <Icon name="mapPin" className="h-4 w-4 text-slate-500" />
              <span className="font-semibold text-slate-800">
                {classroom?.room_name || (fault?.room_id ? `Room ${fault.room_id}` : "Unknown room")}
              </span>
              {locationParts.length > 0 && (
                <span className="text-slate-500">· {locationParts.join(" · ")}</span>
              )}
              {fault && (
                <span className="text-slate-500">
                  ·{" "}
                  {fault.device_id !== null && fault.device_id !== undefined
                    ? <span className="num">Device #{fault.device_id}</span>
                    : "Room-level fault"}
                </span>
              )}
            </p>
          )}

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
            Review the confirmed fault, perform the required maintenance,
            record maintenance notes, and update the ticket status.
          </p>
        </div>

        {/* Status update */}
        <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6 sm:py-5">
          <p className="eyebrow mb-3">Update status</p>

          {ticket.status === "REOPENED" && (
            <Alert tone="warning" title="Ticket reopened" className="mb-4">
              The fault persists and requires maintenance verification
              again before the ticket can be resolved.
            </Alert>
          )}

          {isClosed ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-surface px-4 py-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Icon name="lock" className="h-[18px] w-[18px]" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Ticket closed</p>
                <p className="text-xs text-slate-500">
                  No further changes can be made to a closed ticket.
                </p>
              </div>
            </div>
          ) : canResolve || canClose ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {canResolve && (
                <button
                  type="button"
                  onClick={() => runAction("RESOLVED", () => updateTicketStatus("RESOLVED"))}
                  disabled={actionLoading}
                  className="btn btn-lg btn-success h-12 w-full text-[15px] sm:w-auto sm:min-w-[220px]"
                >
                  {actionLoading && pendingAction === "RESOLVED" ? (
                    <Spinner className="h-5 w-5" />
                  ) : (
                    <Icon name="checkCircle" className="h-5 w-5" />
                  )}
                  {busyLabel("RESOLVED", "Mark as resolved")}
                </button>
              )}

              {canClose && (
                <button
                  type="button"
                  onClick={() => runAction("CLOSED", () => updateTicketStatus("CLOSED"))}
                  disabled={actionLoading}
                  className="btn btn-lg btn-primary h-12 w-full text-[15px] sm:w-auto sm:min-w-[220px]"
                >
                  {actionLoading && pendingAction === "CLOSED" ? (
                    <Spinner className="h-5 w-5" />
                  ) : (
                    <Icon name="lock" className="h-5 w-5" />
                  )}
                  {busyLabel("CLOSED", "Close ticket")}
                </button>
              )}

              <p className="help-text mt-0 flex items-center gap-1.5 sm:ml-1">
                <Icon name="info" className="h-3.5 w-3.5" />
                Your maintenance notes are sent with the status update.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No status actions are available for this ticket right now.
            </p>
          )}

          {actionError && (
            <Alert tone="danger" className="mt-4" onDismiss={() => setActionError("")}>
              {actionError}
            </Alert>
          )}

          {successMessage && (
            <Alert tone="success" className="mt-4" onDismiss={() => setSuccessMessage("")}>
              {successMessage}
            </Alert>
          )}
        </div>
      </section>

      {/* MAIN GRID */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* Maintenance notes */}
          <Card
            title="Maintenance notes"
            subtitle="Work performed, observations and verification"
            icon="clipboard"
          >
            <label htmlFor="maintenance-notes" className="label">
              Work performed
            </label>
            <textarea
              id="maintenance-notes"
              value={maintenanceNotes}
              onChange={(event) =>
                setMaintenanceNotes(event.target.value)
              }
              disabled={isClosed || actionLoading}
              rows={7}
              placeholder={
                isClosed
                  ? "No further changes can be made to a closed ticket."
                  : "Describe the maintenance work performed, observations, replacement, repair, or verification details..."
              }
              className="textarea resize-y leading-relaxed disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />

            {!isClosed && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="help-text mt-0">
                  Save notes at any time without changing the ticket status.
                </p>
                <button
                  type="button"
                  onClick={() => runAction("NOTES", saveMaintenanceNotes)}
                  disabled={actionLoading}
                  className="btn btn-secondary h-11 w-full sm:h-9 sm:w-auto"
                >
                  {actionLoading && pendingAction === "NOTES" ? (
                    <Spinner />
                  ) : (
                    <Icon name="save" className="h-4 w-4" />
                  )}
                  {actionLoading && pendingAction === "NOTES" ? "Saving…" : "Save notes"}
                </button>
              </div>
            )}
          </Card>

          {/* Fault details */}
          <Card
            title="Confirmed fault"
            subtitle="Source fault for this ticket"
            icon="alert"
            actions={fault?.status && <StatusBadge status={fault.status} label={formatStatus(fault.status)} size="sm" />}
          >
            {fault ? (
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <DetailItem label="Fault type">
                  {formatFaultType(fault.fault_type)}
                </DetailItem>
                <DetailItem label="Fault ID" mono>
                  #{fault.fault_id}
                </DetailItem>
                <DetailItem label="Device" mono={fault.device_id !== null && fault.device_id !== undefined}>
                  {fault.device_id !== null &&
                  fault.device_id !== undefined
                    ? `Device #${fault.device_id}`
                    : "Room-level fault"}
                </DetailItem>
                <DetailItem label="Confidence" mono>
                  {formatConfidence(fault.confidence)}
                </DetailItem>
                <DetailItem label="Abnormal observations" mono>
                  {fault.abnormal_count !== null &&
                  fault.abnormal_count !== undefined
                    ? `${fault.abnormal_count} / 5`
                    : "—"}
                </DetailItem>
                <DetailItem label="Fault status">
                  {formatStatus(fault.status)}
                </DetailItem>
                <DetailItem label="Detected at" mono>
                  {formatDateTime(fault.detected_at)}
                </DetailItem>
                <DetailItem label="Confirmed at" mono>
                  {formatDateTime(fault.confirmed_at)}
                </DetailItem>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">
                Fault information is not available.
              </p>
            )}
          </Card>

          {/* Classroom */}
          <Card title="Location" subtitle="Classroom where the fault was detected" icon="classroom">
            {classroom ? (
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                <DetailItem label="Room">{classroom.room_name || "—"}</DetailItem>
                <DetailItem label="Building">{classroom.building || "—"}</DetailItem>
                <DetailItem label="Floor" mono>{classroom.floor || "—"}</DetailItem>
                <DetailItem label="Room type">{classroom.room_type || "—"}</DetailItem>
                <DetailItem label="Capacity" mono>
                  {classroom.capacity !== null &&
                  classroom.capacity !== undefined
                    ? String(classroom.capacity)
                    : "—"}
                </DetailItem>
                <DetailItem label="Room status">
                  {classroom.status ? (
                    <StatusBadge status={classroom.status} size="sm" />
                  ) : (
                    "—"
                  )}
                </DetailItem>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">
                Classroom information is not available.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Ticket summary */}
          <Card title="Work details" icon="ticket">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailItem label="Ticket ID" mono>
                #{ticket.ticket_id}
              </DetailItem>
              <DetailItem label="Priority">
                {formatPriority(ticket.priority)}
              </DetailItem>
              <DetailItem label="Status">
                {formatStatus(ticket.status)}
              </DetailItem>
              <DetailItem label="Created" mono>
                {formatDateTime(ticket.created_at)}
              </DetailItem>
              <DetailItem label="Resolved" mono>
                {formatDateTime(ticket.resolved_at)}
              </DetailItem>
              <DetailItem label="Closed" mono>
                {formatDateTime(ticket.closed_at)}
              </DetailItem>
            </dl>
          </Card>

          {/* Workflow */}
          <Card title="Ticket progress" icon="layers">
            <ol className="space-y-4">
              <WorkflowStep
                label="OPEN"
                description="Confirmed fault requires maintenance."
                active={ticket.status === "OPEN"}
                completed={
                  ticket.status === "RESOLVED" ||
                  ticket.status === "CLOSED"
                }
              />

              <WorkflowStep
                label="RESOLVED"
                description="Maintenance confirms the issue is fixed."
                active={ticket.status === "RESOLVED"}
                completed={ticket.status === "CLOSED"}
              />

              <WorkflowStep
                label="CLOSED"
                description="Maintenance closes the completed ticket."
                active={ticket.status === "CLOSED"}
                completed={ticket.status === "CLOSED"}
              />
            </ol>
          </Card>

          {/* History */}
          <Card title="Status history" subtitle="Audit trail" icon="history">
            {history.length > 0 ? (
              <ol className="ml-1 space-y-5 border-l border-slate-200">
                {history.map((item, index) => (
                  <HistoryItem
                    key={item.history_id || index}
                    item={item}
                  />
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-500">
                No ticket history is available yet.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------
   COMPONENTS
--------------------------------------------------------- */

function WorkflowStep({
  label,
  description,
  active,
  completed,
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
          completed
            ? "border-emerald-500 bg-emerald-500 text-white"
            : active
            ? "border-brand-500 bg-brand-50 text-brand-600"
            : "border-slate-200 bg-slate-50 text-slate-400"
        }`}
      >
        {completed ? (
          <Icon name="check" className="h-4 w-4" />
        ) : (
          <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
        )}
      </span>

      <div>
        <p
          className={`text-sm font-semibold ${
            active || completed
              ? "text-slate-900"
              : "text-slate-500"
          }`}
        >
          {formatStatus(label)}
          {active && !completed && (
            <span className="ml-2 text-xs font-medium text-brand-600">Current</span>
          )}
          {completed && <span className="sr-only"> (completed)</span>}
        </p>

        <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
    </li>
  );
}

function HistoryItem({ item }) {
  return (
    <li className="relative pl-5">
      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-surface" aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-1.5">
        {item.previous_status && (
          <>
            <StatusBadge status={item.previous_status} label={formatStatus(item.previous_status)} size="sm" />
            <Icon name="arrowRight" className="h-3.5 w-3.5 text-slate-400" />
            <span className="sr-only">to</span>
          </>
        )}
        <StatusBadge status={item.new_status} label={formatStatus(item.new_status)} size="sm" />
      </div>

      <p className="num mt-1.5 text-xs text-slate-500">
        {formatDateTime(item.changed_at)}
      </p>

      {item.note && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
          {item.note}
        </p>
      )}
    </li>
  );
}

function PageLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading ticket…</span>
      <div className="card p-5 sm:p-6">
        <div className="flex gap-2">
          <span className="skeleton h-5 w-20" />
          <span className="skeleton h-5 w-16" />
          <span className="skeleton h-5 w-24" />
        </div>
        <span className="skeleton mt-4 block h-7 w-64 max-w-full" />
        <span className="skeleton mt-3 block h-4 w-full max-w-xl" />
        <span className="skeleton mt-6 block h-12 w-full sm:w-56" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="card h-72 p-5">
          <span className="skeleton block h-4 w-40" />
          <span className="skeleton mt-5 block h-40 w-full" />
        </div>
        <div className="card h-72 p-5">
          <span className="skeleton block h-4 w-32" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index} className="skeleton block h-8 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */

function formatStatus(status) {
  if (!status) {
    return "—";
  }

  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPriority(priority) {
  if (!priority) {
    return "—";
  }

  return (
    priority.charAt(0) +
    priority.slice(1).toLowerCase()
  );
}

function formatFaultType(faultType) {
  if (!faultType) {
    return "—";
  }

  return faultType
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
