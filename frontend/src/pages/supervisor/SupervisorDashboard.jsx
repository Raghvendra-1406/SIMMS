import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  EmptyState,
  IconTile,
  RefreshButton,
  ScoreBar,
  StatCard,
  StatusBadge,
} from "../../components/ui";
import { formatLabel, formatConfidence, isHealthyStatus } from "../../lib/format";
import { navigateTo } from "../../lib/session";

const API_BASE_URL = "http://localhost:8000";

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return value;
  }

  return Number.isInteger(number) ? number : number.toFixed(1);
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function hasValue(value) {
  return value !== null && value !== undefined;
}

/** Reading with a muted unit. */
function Reading({ value, unit }) {
  if (!hasValue(value) || value === "") {
    return <span className="num text-slate-400">—</span>;
  }

  return (
    <span className="num text-slate-900">
      {formatNumber(value)}
      {unit && <span className="ml-0.5 text-[11px] font-normal text-slate-500">{unit}</span>}
    </span>
  );
}

function ViewAllButton({ path, label = "View all" }) {
  return (
    <button type="button" onClick={() => navigateTo(path)} className="btn btn-sm btn-ghost">
      {label}
      <Icon name="arrowRight" className="h-3.5 w-3.5" />
    </button>
  );
}

function TableSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3 p-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, index) => (
        <span key={index} className="skeleton block h-12 w-full" />
      ))}
    </div>
  );
}

function SupervisorDashboard() {
  const [healthData, setHealthData] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [faults, setFaults] = useState([]);
  const [tickets, setTickets] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const supervisorName = localStorage.getItem("name") || "Supervisor";

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

      const [healthResponse, classroomsResponse, faultsResponse, ticketsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/health/classrooms`, {
          headers,
        }),
        fetch(`${API_BASE_URL}/classrooms`, {
          headers,
        }),
        fetch(`${API_BASE_URL}/faults/active`, {
          headers,
        }),
        fetch(`${API_BASE_URL}/tickets/open`, {
          headers,
        }),
      ]);

      if (!healthResponse.ok) {
        throw new Error("Unable to load classroom health.");
      }

      if (!classroomsResponse.ok) {
        throw new Error("Unable to load classrooms.");
      }

      if (!faultsResponse.ok) {
        throw new Error("Unable to load active faults.");
      }

      if (!ticketsResponse.ok) {
        throw new Error("Unable to load open tickets.");
      }

      const healthResult = await healthResponse.json();
      const classroomsResult = await classroomsResponse.json();
      const faultsResult = await faultsResponse.json();
      const ticketsResult = await ticketsResponse.json();

      setHealthData(Array.isArray(healthResult) ? healthResult : []);

      setClassrooms(Array.isArray(classroomsResult) ? classroomsResult : []);

      setFaults(Array.isArray(faultsResult) ? faultsResult : []);

      setTickets(Array.isArray(ticketsResult) ? ticketsResult : []);
    } catch (err) {
      setError(err.message || "Unable to load supervisor dashboard.");
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

  const healthSummary = useMemo(() => {
    let normal = 0;
    let warning = 0;
    let critical = 0;

    healthData.forEach((health) => {
      const status = String(health.health_status || "").toUpperCase();

      if (isHealthyStatus(status)) {
        normal += 1;
      } else if (status === "WARNING") {
        warning += 1;
      } else if (status === "CRITICAL") {
        critical += 1;
      }
    });

    return {
      normal,
      warning,
      critical,
    };
  }, [healthData]);

  const totalActiveFaults = useMemo(() => {
    return healthData.reduce((total, health) => total + Number(health.active_fault_count || 0), 0);
  }, [healthData]);

  const getClassroomName = (roomId) => {
    const classroom = classroomMap[roomId];

    if (!classroom) {
      return `Room ${roomId}`;
    }

    return classroom.room_name || `Room ${roomId}`;
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Load failed and nothing to show: KPI cards display "—" instead of misleading zeros.

  const loadFailed = Boolean(error) && classrooms.length === 0;


  return (
    <AppShell
      eyebrow="Supervisor"
      title="Dashboard"
      actions={<RefreshButton onClick={loadDashboard} loading={loading} />}
    >
      {/* WELCOME */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-1.5">Operations overview</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {greeting}, {supervisorName.split(" ")[0]}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
            Monitor classroom health, active faults, and maintenance activity from one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigateTo("/supervisor/faults")} className="btn btn-secondary">
            <Icon name="alert" className="h-4 w-4" />
            Faults
          </button>
          <button type="button" onClick={() => navigateTo("/supervisor/monitoring")} className="btn btn-primary">
            <Icon name="activity" className="h-4 w-4" />
            Monitoring
          </button>
        </div>
      </div>

      {error && (
        <Alert tone="danger" title={error} onRetry={loadDashboard} className="mb-6">
          Please check that the SIMMS backend is running and try again.
        </Alert>
      )}

      {/* KPIs */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          unavailable={loadFailed}
          label="Classrooms"
          value={classrooms.length}
          hint="Monitored rooms"
          icon="classroom"
          tone="brand"
          loading={loading}
          onClick={() => navigateTo("/supervisor/classrooms")}
        />
        <StatCard
          unavailable={loadFailed}
          label="Healthy"
          value={healthSummary.normal}
          hint="Excellent or good health"
          icon="checkCircle"
          tone="success"
          loading={loading}
        />
        <StatCard
          unavailable={loadFailed}
          label="Warning"
          value={healthSummary.warning}
          hint="Needs a closer look"
          icon="alert"
          tone="warning"
          loading={loading}
        />
        <StatCard
          unavailable={loadFailed}
          label="Critical"
          value={healthSummary.critical}
          hint="Immediate attention"
          icon="alertCircle"
          tone="danger"
          loading={loading}
        />
        <StatCard
          unavailable={loadFailed}
          label="Open tickets"
          value={tickets.length}
          hint={tickets.length > 0 ? "Awaiting maintenance" : "Queue is clear"}
          icon="ticket"
          tone={tickets.length > 0 ? "info" : "neutral"}
          loading={loading}
          onClick={() => navigateTo("/supervisor/tickets")}
        />
      </section>

      {/* HEALTH + FAULTS */}
      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card
          title="Classroom health"
          subtitle="Latest calculated classroom health"
          icon="heart"
          bodyClassName=""
          actions={<ViewAllButton path="/supervisor/classrooms" />}
        >
          {loading ? (
            <TableSkeleton rows={4} />
          ) : healthData.length === 0 ? (
            <EmptyState
              icon="heart"
              title="No classroom health data"
              description="Health scores appear here once monitoring records are calculated."
            />
          ) : (
            <div className="table-wrap">
              <table className="table min-w-[680px]">
                <thead>
                  <tr>
                    <th scope="col">Classroom</th>
                    <th scope="col">Status</th>
                    <th scope="col">Score</th>
                    <th scope="col" className="text-right">Faults</th>
                    <th scope="col" className="text-right">Occupancy</th>
                    <th scope="col" className="text-right">Power</th>
                  </tr>
                </thead>
                <tbody>
                  {healthData.map((health) => (
                    <tr key={health.room_id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => navigateTo(`/supervisor/classrooms/${health.room_id}`)}
                          className="group text-left"
                        >
                          <p className="font-semibold text-slate-900 transition-colors group-hover:text-brand-700">
                            {getClassroomName(health.room_id)}
                          </p>
                          <p className="num mt-0.5 text-[11px] text-slate-500">ID {health.room_id}</p>
                        </button>
                      </td>
                      <td>
                        <StatusBadge status={health.health_status || "UNKNOWN"} />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="num w-9 text-sm font-semibold text-slate-900">
                            {formatNumber(health.health_score)}
                          </span>
                          {hasValue(health.health_score) && (
                            <ScoreBar value={health.health_score} className="w-20" />
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <span
                          className={`num font-semibold ${
                            Number(health.active_fault_count) > 0 ? "text-red-600" : "text-slate-500"
                          }`}
                        >
                          {health.active_fault_count ?? 0}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="num text-slate-700">{health.occupancy_count ?? "—"}</span>
                      </td>
                      <td className="text-right">
                        <Reading value={health.power} unit="W" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title="Active faults"
          subtitle="Confirmed faults requiring attention"
          icon="alert"
          bodyClassName=""
          actions={<ViewAllButton path="/supervisor/faults" />}
        >
          {loading ? (
            <TableSkeleton rows={3} />
          ) : faults.length === 0 ? (
            <EmptyState
              icon={loadFailed ? "wifiOff" : "checkCircle"}
              title={loadFailed ? "Faults unavailable" : "No active faults"}
              description={loadFailed ? "Fault data could not be loaded. Retry once the backend is reachable." : "No confirmed fault is currently requiring attention."}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {faults.slice(0, 5).map((fault) => (
                <li key={fault.fault_id}>
                  <button
                    type="button"
                    onClick={() => navigateTo(`/supervisor/faults/${fault.fault_id}`)}
                    className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50"
                  >
                    <IconTile icon="alert" tone="danger" className="h-8 w-8" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {fault.fault_type ? formatLabel(fault.fault_type) : "Fault"}
                        </p>
                        {fault.status ? (
                          <StatusBadge status={fault.status} size="sm" />
                        ) : (
                          <StatusBadge tone="danger" label="Active" size="sm" />
                        )}
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{getClassroomName(fault.room_id)}</span>
                        {hasValue(fault.device_id) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="num">Device #{fault.device_id}</span>
                          </>
                        )}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Icon name="clock" className="h-3 w-3" />
                          <span className="num">{formatDate(fault.detected_at)}</span>
                        </span>
                        <span className="num font-medium text-slate-700">
                          {formatConfidence(fault.confidence)} conf.
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

      {/* ENVIRONMENT */}
      <Card
        className="mt-6"
        title="Classroom environment"
        subtitle="Latest temperature, humidity, occupancy, and power values"
        icon="thermometer"
        actions={<ViewAllButton path="/supervisor/monitoring" label="Live view" />}
      >
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
            {[1, 2, 3, 4].map((item) => (
              <span key={item} className="skeleton block h-28 w-full" />
            ))}
          </div>
        ) : healthData.length === 0 ? (
          <EmptyState
            icon="thermometer"
            title="No environmental data"
            description="Readings appear here once classroom sensors report in."
            className="py-6"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {healthData.slice(0, 8).map((health) => (
              <div key={health.room_id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-900">{getClassroomName(health.room_id)}</p>
                  <StatusBadge status={health.health_status || "UNKNOWN"} size="sm" />
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
                  {[
                    { label: "Temperature", icon: "thermometer", value: health.temperature, unit: "°C" },
                    { label: "Humidity", icon: "gauge", value: health.humidity, unit: "%" },
                    { label: "Occupancy", icon: "users", value: health.occupancy_count, unit: "" },
                    { label: "Power", icon: "zap", value: health.power, unit: "W" },
                  ].map((metric) => (
                    <div key={metric.label} className="min-w-0">
                      <dt className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        <Icon name={metric.icon} className="h-3 w-3" />
                        {metric.label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold">
                        <Reading value={metric.value} unit={metric.unit} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* OPEN TICKETS */}
      <Card
        className="mt-6"
        title="Open maintenance tickets"
        subtitle="Tickets currently requiring maintenance attention"
        icon="ticket"
        bodyClassName=""
        actions={<ViewAllButton path="/supervisor/tickets" />}
      >
        {loading ? (
          <TableSkeleton rows={3} />
        ) : tickets.length === 0 ? (
          <EmptyState icon="ticket" title="No open maintenance tickets" description="All maintenance work is up to date." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[640px]">
              <thead>
                <tr>
                  <th scope="col">Ticket</th>
                  <th scope="col">Fault</th>
                  <th scope="col">Priority</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.slice(0, 6).map((ticket) => (
                  <tr
                    key={ticket.ticket_id}
                    onClick={() => navigateTo(`/supervisor/tickets/${ticket.ticket_id}`)}
                    className="cursor-pointer"
                  >
                    <td>
                      <button
                        type="button"
                        className="num font-semibold text-slate-900 hover:text-brand-700"
                        aria-label={`Open ticket ${ticket.ticket_id}`}
                      >
                        #{ticket.ticket_id}
                      </button>
                    </td>
                    <td>
                      <span className="num text-slate-600">{ticket.fault_id ? `Fault #${ticket.fault_id}` : "—"}</span>
                    </td>
                    <td>
                      {ticket.priority ? (
                        <StatusBadge status={ticket.priority} dot={false} size="sm" />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={ticket.status || "OPEN"} />
                    </td>
                    <td className="text-right">
                      <span className="num text-xs text-slate-500">{formatDate(ticket.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-500">
        <Icon name="activity" className="h-3.5 w-3.5" />
        {loading ? (
          "Loading monitoring data…"
        ) : (
          <span>
            <span className="num font-semibold text-slate-700">{totalActiveFaults}</span> active fault
            {totalActiveFaults === 1 ? "" : "s"} currently reported across classroom health records
          </span>
        )}
      </p>
    </AppShell>
  );
}

export default SupervisorDashboard;
