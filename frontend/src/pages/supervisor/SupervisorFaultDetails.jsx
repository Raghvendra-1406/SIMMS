import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  DetailItem,
  EmptyState,
  IconTile,
  RefreshButton,
  StatusBadge,
} from "../../components/ui";
import { formatLabel, formatConfidence } from "../../lib/format";
import { navigateTo } from "../../lib/session";

const API_BASE_URL = "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    "Content-Type": "application/json",
    ...(token
      ? { Authorization: `Bearer ${token}` }
      : {}),
  };
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getFaultTypeLabel(faultType) {
  const labels = {
    FAN_FAILURE: "Fan failure",
    LIGHTS_LEFT_ON: "Lights left on",
    BOARD_NEEDS_CLEANING: "Board needs cleaning",
    ELECTRICAL_ABNORMALITY:
      "Electrical abnormality",
  };

  return (
    labels[faultType] ||
    String(faultType || "Unknown").replaceAll(
      "_",
      " "
    )
  );
}

// Icon + tone per fault type (replaces the old per-type colour classes).
const FAULT_TYPE_META = {
  FAN_FAILURE: { icon: "fan", tone: "warning" },
  LIGHTS_LEFT_ON: { icon: "lightbulb", tone: "warning" },
  BOARD_NEEDS_CLEANING: { icon: "clipboard", tone: "info" },
  ELECTRICAL_ABNORMALITY: { icon: "zap", tone: "danger" },
};

function getFaultTypeMeta(faultType) {
  return (
    FAULT_TYPE_META[String(faultType || "").toUpperCase()] || {
      icon: "alert",
      tone: "neutral",
    }
  );
}

// The original page styled ACTIVE faults red and unknown statuses amber.
function getFaultStatusTone(status) {
  const key = String(status || "").toUpperCase();

  if (key === "ACTIVE" || key === "CONFIRMED") return "danger";
  if (key === "RESOLVED" || key === "CLEARED") return "success";
  if (key === "CLOSED" || key === "FALSE_POSITIVE") return "neutral";

  return undefined;
}

function DetailsSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading fault details…</span>
      <div className="card p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="skeleton h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-3">
            <span className="skeleton block h-5 w-48" />
            <span className="skeleton block h-3 w-32" />
          </div>
          <span className="skeleton hidden h-14 w-32 sm:block" />
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="card h-80 p-5">
          <span className="skeleton block h-4 w-40" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index} className="skeleton block h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="card h-80 p-5">
          <span className="skeleton block h-4 w-32" />
          <div className="mt-6 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <span key={index} className="skeleton block h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SupervisorFaultDetails() {
  const [fault, setFault] =
    useState(null);

  const [classroom, setClassroom] =
    useState(null);

  const [ticket, setTicket] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const faultId =
    window.location.pathname.split("/").pop();

  useEffect(() => {
    if (faultId) {
      loadFaultDetails();
    } else {
      setError("Invalid fault ID.");
      setLoading(false);
    }
  }, [faultId]);

  async function fetchApi(endpoint) {
    const response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        method: "GET",
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      let message = `Request failed with status ${response.status}.`;

      try {
        const data =
          await response.json();

        if (data?.detail) {
          message = data.detail;
        }
      } catch {
        // Keep default message.
      }

      throw new Error(message);
    }

    return response.json();
  }

  async function loadFaultDetails() {
    setLoading(true);
    setError("");

    try {
      const faultData =
        await fetchApi(
          `/faults/${faultId}`
        );

      setFault(faultData);

      const roomId =
        faultData?.room_id;

      if (roomId) {
        try {
          const classroomData =
            await fetchApi(
              `/classrooms/${roomId}`
            );

          setClassroom(
            classroomData
          );
        } catch {
          setClassroom(null);
        }
      }

      try {
        const ticketData =
          await fetchApi(
            `/tickets/fault/${faultId}`
          );

        /*
         * The endpoint may return either:
         * - one ticket object
         * - an array of tickets
         *
         * Keep the frontend tolerant without
         * inventing ticket information.
         */
        if (
          Array.isArray(ticketData)
        ) {
          setTicket(
            ticketData.length > 0
              ? ticketData[0]
              : null
          );
        } else if (
          ticketData?.data
        ) {
          if (
            Array.isArray(
              ticketData.data
            )
          ) {
            setTicket(
              ticketData.data.length > 0
                ? ticketData.data[0]
                : null
            );
          } else {
            setTicket(
              ticketData.data
            );
          }
        } else {
          setTicket(ticketData);
        }
      } catch {
        /*
         * A fault can exist before a ticket
         * has been created. Therefore a failed
         * ticket request should not make the
         * entire fault details page fail.
         */
        setTicket(null);
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to load fault details."
      );
    } finally {
      setLoading(false);
    }
  }

  const displayId = fault?.fault_id ?? faultId;
  const meta = getFaultTypeMeta(fault?.fault_type);

  const timeline = fault
    ? [
        { label: "Detected", value: fault.detected_at, icon: "crosshair" },
        { label: "Confirmed", value: fault.confirmed_at, icon: "checkCircle" },
        { label: "Record created", value: fault.created_at, icon: "clipboard" },
      ]
    : [];

  return (
    <AppShell
      eyebrow="Faults"
      title={displayId ? `Fault #${displayId}` : "Fault details"}
      backHref="/supervisor/faults"
      actions={<RefreshButton onClick={loadFaultDetails} loading={loading} />}
    >
      {loading ? (
        <DetailsSkeleton />
      ) : (
        <>
          {error && (
            <Alert tone="danger" title="Unable to load fault details" onRetry={loadFaultDetails}>
              {error}
            </Alert>
          )}

          {!error && fault && (
            <>
              {/* Summary */}
              <section className="card p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <IconTile icon={meta.icon} tone={meta.tone} className="h-12 w-12 rounded-xl" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={meta.tone} label={getFaultTypeLabel(fault.fault_type)} dot={false} />
                        <StatusBadge
                          status={fault.status}
                          tone={getFaultStatusTone(fault.status) || (fault.status ? undefined : "warning")}
                          label={fault.status ? formatLabel(fault.status) : "Unknown"}
                        />
                      </div>
                      <h2 className="mt-2.5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                        {getFaultTypeLabel(fault.fault_type)}
                      </h2>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-slate-500">
                        <span className="font-medium text-slate-700">
                          {classroom?.room_name || `Room ${fault.room_id}`}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="num">
                          {fault.device_id ? `Device #${fault.device_id}` : "Room-level fault"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="num">Fault #{fault.fault_id}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-stretch gap-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 sm:min-w-[140px]">
                      <p className="text-xs font-medium text-slate-500">Confidence</p>
                      <p className="num mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">
                        {formatConfidence(fault.confidence)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3 sm:min-w-[140px]">
                      <p className="text-xs font-medium text-slate-500">Abnormal readings</p>
                      <p className="num mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">
                        {fault.abnormal_count ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                {/* Left column */}
                <div className="space-y-6">
                  <Card title="Fault details" subtitle="Read from the backend fault record" icon="alert">
                    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                      <DetailItem label="Fault type">{getFaultTypeLabel(fault.fault_type)}</DetailItem>
                      <DetailItem label="Status">{fault.status ? formatLabel(fault.status) : "Unknown"}</DetailItem>
                      <DetailItem label="Classroom">{classroom?.room_name || `Room ${fault.room_id}`}</DetailItem>
                      <DetailItem label="Room ID" mono>{fault.room_id ?? "—"}</DetailItem>
                      <DetailItem label="Device" mono>
                        {fault.device_id ? `Device #${fault.device_id}` : "Room-level fault"}
                      </DetailItem>
                      <DetailItem label="Abnormal observations" mono>{fault.abnormal_count ?? "—"}</DetailItem>
                      <DetailItem label="Confidence" mono>{formatConfidence(fault.confidence)}</DetailItem>
                      <DetailItem label="Fault ID" mono>{fault.fault_id}</DetailItem>
                    </dl>
                  </Card>

                  <Card
                    title="Classroom information"
                    subtitle="Location of the affected infrastructure"
                    icon="classroom"
                    actions={
                      classroom && (
                        <button
                          type="button"
                          onClick={() =>
                            navigateTo(
                              `/supervisor/classrooms/${fault.room_id}`
                            )
                          }
                          className="btn btn-sm btn-secondary"
                        >
                          View classroom
                          <Icon name="arrowRight" className="h-3.5 w-3.5" />
                        </button>
                      )
                    }
                  >
                    {classroom ? (
                      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        <DetailItem label="Room name">{classroom.room_name || "—"}</DetailItem>
                        <DetailItem label="Room type">{classroom.room_type ? formatLabel(classroom.room_type) : "—"}</DetailItem>
                        <DetailItem label="Building">{classroom.building || "—"}</DetailItem>
                        <DetailItem label="Floor" mono>{classroom.floor ?? "—"}</DetailItem>
                        <DetailItem label="Capacity" mono>{classroom.capacity ?? "—"}</DetailItem>
                        <DetailItem label="Status">
                          {classroom.status ? <StatusBadge status={classroom.status} size="sm" /> : "—"}
                        </DetailItem>
                      </dl>
                    ) : (
                      <EmptyState
                        icon="building"
                        title="Classroom information is unavailable"
                        description={`The fault record still identifies this classroom as Room #${fault.room_id}.`}
                        className="py-8"
                      />
                    )}
                  </Card>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                  <Card title="Detection timeline" subtitle="Fault lifecycle" icon="history">
                    <ol className="relative ml-1.5 space-y-5 border-l border-slate-200">
                      {timeline.map((step) => {
                        const reached = Boolean(step.value);

                        return (
                          <li key={step.label} className="relative pl-6">
                            <span
                              className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${reached ? "bg-brand-500" : "bg-slate-300"}`}
                              aria-hidden="true"
                            />
                            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                              <Icon name={step.icon} className="h-3.5 w-3.5" />
                              {step.label}
                            </p>
                            <p className={`num mt-0.5 text-sm ${reached ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                              {reached ? formatDateTime(step.value) : "Not recorded"}
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  </Card>

                  <Card title="Related ticket" subtitle="Maintenance work for this fault" icon="ticket">
                    {ticket ? (
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="num text-sm font-semibold text-slate-900">
                              Ticket #{ticket.ticket_id ?? "—"}
                            </span>
                            {ticket.status && <StatusBadge status={ticket.status} size="sm" />}
                          </div>
                          {ticket.ticket_id && (
                            <button
                              type="button"
                              onClick={() =>
                                navigateTo(
                                  `/supervisor/tickets/${ticket.ticket_id}`
                                )
                              }
                              className="btn btn-sm btn-primary"
                            >
                              Open ticket
                              <Icon name="arrowRight" className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                          <DetailItem label="Priority">
                            {ticket.priority ? <StatusBadge status={ticket.priority} dot={false} size="sm" /> : "—"}
                          </DetailItem>
                          <DetailItem label="Created" mono>{formatDateTime(ticket.created_at)}</DetailItem>
                          <DetailItem label="Resolved" mono>{formatDateTime(ticket.resolved_at)}</DetailItem>
                        </dl>

                        {ticket.maintenance_notes && (
                          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                            <p className="text-xs font-medium text-slate-500">Maintenance notes</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {ticket.maintenance_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <EmptyState
                        icon="ticket"
                        title="No related ticket found"
                        description="This fault currently does not have a ticket returned by the ticket endpoint."
                        className="py-8"
                      />
                    )}
                  </Card>

                  <Alert tone="info" title="Monitoring continues">
                    SIMMS continues monitoring the classroom independently of this fault record. The fault details shown here are read from the backend fault record.
                  </Alert>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
