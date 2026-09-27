import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  EmptyState,
  IconTile,
  RefreshButton,
  StatCard,
  StatusBadge,
} from "../../components/ui";
import { statusTone } from "../../lib/format";
import { navigateTo } from "../../lib/session";

const API_BASE_URL = "http://localhost:8000";

// CRITICAL is not part of the shared tone map, so resolve priority tones here.
function priorityTone(priority) {
  const normalized = String(priority || "").toUpperCase();
  if (normalized === "CRITICAL") return "danger";
  return statusTone(normalized);
}

const WORKFLOW_STEPS = [
  {
    number: "01",
    title: "Open",
    description: "Review the confirmed maintenance ticket.",
    icon: "inbox",
    active: true,
  },
  {
    number: "02",
    title: "Resolved",
    description: "Mark the ticket resolved after the fault has been repaired.",
    icon: "checkCircle",
  },
  {
    number: "03",
    title: "Closed",
    description: "Close the completed maintenance ticket.",
    icon: "lock",
  },
];

function QueueSkeleton({ rows = 4 }) {
  return (
    <ul className="divide-y divide-slate-100" aria-busy="true" aria-live="polite">
      <li className="sr-only">Loading…</li>
      {Array.from({ length: rows }).map((_, index) => (
        <li key={index} className="flex items-center gap-3 px-5 py-4">
          <span className="skeleton h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <span className="skeleton block h-3.5 w-1/3" />
            <span className="skeleton block h-3 w-1/2" />
          </div>
          <span className="skeleton h-6 w-16" />
        </li>
      ))}
    </ul>
  );
}

function MaintenanceDashboard() {
  const [tickets, setTickets] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [faults, setFaults] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const maintenanceName =
    localStorage.getItem("name") || "Maintenance Staff";

  const token = localStorage.getItem("access_token");

  const loadDashboard = useCallback(async () => {
    if (!token) {
      window.location.href = "/";
      return;
    }

    setLoading(true);
    setError("");

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [
        ticketsResponse,
        classroomsResponse,
        faultsResponse,
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/tickets/open`, {
          headers,
        }),
        fetch(`${API_BASE_URL}/classrooms`, {
          headers,
        }),
        fetch(`${API_BASE_URL}/faults/active`, {
          headers,
        }),
      ]);

      if (!ticketsResponse.ok) {
        throw new Error(
          "Unable to load open maintenance tickets."
        );
      }

      if (!classroomsResponse.ok) {
        throw new Error(
          "Unable to load classrooms."
        );
      }

      if (!faultsResponse.ok) {
        throw new Error(
          "Unable to load active faults."
        );
      }

      const ticketsResult =
        await ticketsResponse.json();

      const classroomsResult =
        await classroomsResponse.json();

      const faultsResult =
        await faultsResponse.json();

      setTickets(
        Array.isArray(ticketsResult)
          ? ticketsResult
          : []
      );

      setClassrooms(
        Array.isArray(classroomsResult)
          ? classroomsResult
          : []
      );

      setFaults(
        Array.isArray(faultsResult)
          ? faultsResult
          : []
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load maintenance dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const classroomMap = useMemo(() => {
    const map = {};

    classrooms.forEach((classroom) => {
      map[classroom.room_id] = classroom;
    });

    return map;
  }, [classrooms]);

  const faultMap = useMemo(() => {
    const map = {};

    faults.forEach((fault) => {
      map[fault.fault_id] = fault;
    });

    return map;
  }, [faults]);

  const ticketSummary = useMemo(() => {
    let open = 0;
    let highPriority = 0;

    tickets.forEach((ticket) => {
      const status = String(
        ticket.status || ""
      ).toUpperCase();

      const priority = String(
        ticket.priority || ""
      ).toUpperCase();

      if (status === "OPEN") {
        open += 1;
      }

      if (
        priority === "HIGH" ||
        priority === "CRITICAL"
      ) {
        highPriority += 1;
      }
    });

    return {
      open,
      highPriority,
    };
  }, [tickets]);

  const getClassroomName = (roomId) => {
    const classroom = classroomMap[roomId];

    if (!classroom) {
      return `Room ${roomId}`;
    }

    return (
      classroom.room_name ||
      `Room ${roomId}`
    );
  };

  const getFaultForTicket = (ticket) => {
    if (!ticket?.fault_id) {
      return null;
    }

    return faultMap[ticket.fault_id] || null;
  };

  const getFaultType = (ticket) => {
    const fault = getFaultForTicket(ticket);

    return (
      fault?.fault_type ||
      "Infrastructure fault"
    );
  };

  const getRoomForTicket = (ticket) => {
    const fault = getFaultForTicket(ticket);

    if (!fault) {
      return "—";
    }

    return getClassroomName(
      fault.room_id
    );
  };

  const formatDate = (value) => {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString();
  };

  const formatFaultType = (faultType) => {
    if (!faultType) {
      return "Infrastructure fault";
    }

    return String(faultType)
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <AppShell
      eyebrow="Maintenance"
      title="Dashboard"
      actions={<RefreshButton onClick={loadDashboard} loading={loading} />}
    >
      {/* WELCOME */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-1.5">Maintenance work queue</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {greeting}, {maintenanceName.split(" ")[0]}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Review confirmed infrastructure faults and work through open maintenance tickets.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo("/maintenance/tickets")}
          className="btn btn-lg btn-primary w-full sm:w-auto"
        >
          <Icon name="wrench" className="h-4 w-4" />
          Open my tickets
        </button>
      </div>

      {error && (
        <Alert tone="danger" title={error} onRetry={loadDashboard} className="mb-6">
          Please check that the SIMMS backend is running and try again.
        </Alert>
      )}

      {/* KPIs */}
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Open tickets"
          value={ticketSummary.open}
          loading={loading}
          hint={ticketSummary.open > 0 ? "Awaiting maintenance" : "Queue is clear"}
          icon="ticket"
          tone={ticketSummary.open > 0 ? "brand" : "success"}
          onClick={() => navigateTo("/maintenance/tickets")}
        />
        <StatCard
          label="High priority"
          value={ticketSummary.highPriority}
          loading={loading}
          hint={ticketSummary.highPriority > 0 ? "Handle these first" : "No urgent work"}
          icon="zap"
          tone={ticketSummary.highPriority > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Active faults"
          value={faults.length}
          loading={loading}
          hint={faults.length > 0 ? "Confirmed and awaiting repair" : "No confirmed faults"}
          icon="alert"
          tone={faults.length > 0 ? "danger" : "success"}
        />
      </section>

      {/* WORK QUEUE + FAULTS */}
      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card
          title="Work queue"
          subtitle={
            loading
              ? "Loading open tickets…"
              : `${tickets.length} open ticket${tickets.length === 1 ? "" : "s"} requiring attention`
          }
          icon="wrench"
          bodyClassName=""
          actions={
            <button
              type="button"
              onClick={() => navigateTo("/maintenance/tickets")}
              className="btn btn-sm btn-ghost"
            >
              View all
              <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </button>
          }
        >
          {loading ? (
            <QueueSkeleton />
          ) : tickets.length === 0 ? (
            <EmptyState
              icon="checkCircle"
              title="No open maintenance tickets"
              description="New tickets appear here as soon as a fault is confirmed."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {tickets.slice(0, 8).map((ticket) => {
                const tone = priorityTone(ticket.priority);

                return (
                  <li key={ticket.ticket_id}>
                    <button
                      type="button"
                      onClick={() =>
                        navigateTo(
                          `/maintenance/tickets/${ticket.ticket_id}`
                        )
                      }
                      className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors duration-150 hover:bg-slate-50 focus-visible:bg-slate-50"
                    >
                      <IconTile
                        icon="wrench"
                        tone={tone === "orange" ? "warning" : tone}
                        className="h-10 w-10"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="num text-sm font-semibold text-slate-900">
                            #{ticket.ticket_id}
                          </span>
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {formatFaultType(getFaultType(ticket))}
                          </span>
                        </div>

                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                          <Icon name="mapPin" className="h-3 w-3" />
                          <span className="font-medium text-slate-700">
                            {getRoomForTicket(ticket)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="num">
                            Fault #{ticket.fault_id || "—"}
                          </span>
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {ticket.priority && (
                            <StatusBadge
                              status={ticket.priority}
                              tone={tone}
                              label={`${String(ticket.priority).charAt(0)}${String(ticket.priority).slice(1).toLowerCase()} priority`}
                              size="sm"
                            />
                          )}
                          <StatusBadge status={ticket.status || "OPEN"} size="sm" />
                          <span className="num flex items-center gap-1 text-[11px] text-slate-500">
                            <Icon name="clock" className="h-3 w-3" />
                            {formatDate(ticket.created_at)}
                          </span>
                        </div>
                      </div>

                      <Icon
                        name="chevronRight"
                        className="h-5 w-5 shrink-0 text-slate-400 transition-colors group-hover:text-slate-600"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title="Active faults"
          subtitle="Current infrastructure issues requiring attention"
          icon="alert"
          bodyClassName=""
          actions={
            !loading &&
            (faults.length > 0 ? (
              <StatusBadge tone="danger" label={`${faults.length} active`} />
            ) : (
              <StatusBadge tone="success" label="All clear" />
            ))
          }
        >
          {loading ? (
            <QueueSkeleton rows={3} />
          ) : faults.length === 0 ? (
            <EmptyState
              icon="checkCircle"
              title="No active faults"
              description="No confirmed infrastructure fault is currently active."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {faults.slice(0, 5).map((fault) => (
                <li key={fault.fault_id}>
                  <button
                    type="button"
                    onClick={() =>
                      navigateTo(
                        `/maintenance/tickets/${
                          tickets.find(
                            (ticket) =>
                              ticket.fault_id ===
                              fault.fault_id
                          )?.ticket_id || ""
                        }`
                      )
                    }
                    className="group flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-slate-50 focus-visible:bg-slate-50"
                  >
                    <IconTile icon="alert" tone="danger" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {formatFaultType(fault.fault_type)}
                        </p>
                        <StatusBadge status={fault.status || "ACTIVE"} size="sm" />
                      </div>

                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">
                          {getClassroomName(fault.room_id)}
                        </span>
                        {fault.device_id !== null &&
                          fault.device_id !== undefined && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="num">Device #{fault.device_id}</span>
                            </>
                          )}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="num">
                          {fault.abnormal_count ?? "—"} abnormal obs.
                        </span>
                        <span className="num flex items-center gap-1">
                          <Icon name="clock" className="h-3 w-3" />
                          {formatDate(
                            fault.confirmed_at ||
                              fault.detected_at
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* WORKFLOW */}
      <Card
        className="mt-6"
        title="Maintenance workflow"
        subtitle="Current ticket lifecycle used by SIMMS"
        icon="layers"
      >
        <ol className="grid gap-3 sm:grid-cols-3">
          {WORKFLOW_STEPS.map((step) => (
            <li
              key={step.number}
              className={`rounded-lg border p-4 ${
                step.active
                  ? "border-brand-200 bg-brand-50/50"
                  : "border-slate-200 bg-slate-50/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    step.active
                      ? "bg-brand-600 text-white"
                      : "bg-white text-slate-500 ring-1 ring-slate-200"
                  }`}
                >
                  <Icon name={step.icon} className="h-4 w-4" />
                </span>
                <div>
                  <p className="num text-[11px] font-medium text-slate-500">Step {step.number}</p>
                  <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                </div>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </Card>
    </AppShell>
  );
}

export default MaintenanceDashboard;
