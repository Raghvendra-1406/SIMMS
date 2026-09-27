import { useEffect, useMemo, useState } from "react";
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
import { formatLabel, formatConfidence } from "../../lib/format";
import { navigateTo } from "../../lib/session";

const API_BASE_URL = "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

const HEALTH_SEGMENTS = [
  { key: "excellent", label: "Excellent", bar: "bg-emerald-500", text: "text-emerald-700" },
  { key: "good", label: "Good", bar: "bg-green-400", text: "text-green-700" },
  { key: "warning", label: "Warning", bar: "bg-amber-400", text: "text-amber-700" },
  { key: "critical", label: "Critical", bar: "bg-red-500", text: "text-red-700" },
];

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading dashboard…</span>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card p-5">
            <span className="skeleton block h-3 w-24" />
            <span className="skeleton mt-3 block h-8 w-16" />
            <span className="skeleton mt-3 block h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="card h-[420px] p-5">
          <span className="skeleton block h-4 w-40" />
          <span className="skeleton mt-6 block h-3 w-full" />
          <div className="mt-8 space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index} className="skeleton block h-8 w-full" />
            ))}
          </div>
        </div>
        <div className="card h-[420px] p-5">
          <span className="skeleton block h-4 w-32" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index} className="skeleton block h-14 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [classrooms, setClassrooms] = useState([]);
  const [devices, setDevices] = useState([]);
  const [faults, setFaults] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [healthScores, setHealthScores] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const adminName =
    localStorage.getItem("name") || "Administrator";

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const headers = getAuthHeaders();

      const [
        classroomsResponse,
        devicesResponse,
        faultsResponse,
        ticketsResponse,
        healthResponse,
        usersResponse,
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/classrooms`, {
          headers,
        }),

        fetch(`${API_BASE_URL}/devices`, {
          headers,
        }),

        fetch(`${API_BASE_URL}/faults/active`, {
          headers,
        }),

        fetch(`${API_BASE_URL}/tickets`, {
          headers,
        }),

        fetch(`${API_BASE_URL}/health/classrooms`, {
          headers,
        }),

        fetch(`${API_BASE_URL}/users`, {
          headers,
        }),
      ]);

      if (
        !classroomsResponse.ok ||
        !devicesResponse.ok ||
        !faultsResponse.ok ||
        !ticketsResponse.ok ||
        !healthResponse.ok ||
        !usersResponse.ok
      ) {
        throw new Error(
          "Unable to load dashboard data from the SIMMS backend."
        );
      }

      const [
        classroomsData,
        devicesData,
        faultsData,
        ticketsData,
        healthData,
        usersData,
      ] = await Promise.all([
        classroomsResponse.json(),
        devicesResponse.json(),
        faultsResponse.json(),
        ticketsResponse.json(),
        healthResponse.json(),
        usersResponse.json(),
      ]);

      setClassrooms(
        Array.isArray(classroomsData)
          ? classroomsData
          : []
      );

      setDevices(
        Array.isArray(devicesData)
          ? devicesData
          : []
      );

      setFaults(
        Array.isArray(faultsData)
          ? faultsData
          : []
      );

      setTickets(
        Array.isArray(ticketsData)
          ? ticketsData
          : []
      );

      setHealthScores(
        Array.isArray(healthData)
          ? healthData
          : []
      );

      setUsers(
        Array.isArray(usersData)
          ? usersData
          : []
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the SIMMS backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const activeClassrooms = classrooms.filter(
    (classroom) => classroom.status === "ACTIVE"
  );

  const activeDevices = devices.filter(
    (device) => device.status === "ACTIVE"
  );

  const activeUsers = users.filter(
    (user) => user.is_active
  );

  const openTickets = tickets.filter(
    (ticket) =>
      ticket.status === "OPEN" ||
      ticket.status === "IN_PROGRESS" ||
      ticket.status === "REOPENED"
  );

  const healthSummary = useMemo(() => {
    return {
      excellent: healthScores.filter(
        (item) => item.health_status === "EXCELLENT"
      ).length,

      good: healthScores.filter(
        (item) => item.health_status === "GOOD"
      ).length,

      warning: healthScores.filter(
        (item) => item.health_status === "WARNING"
      ).length,

      critical: healthScores.filter(
        (item) => item.health_status === "CRITICAL"
      ).length,
    };
  }, [healthScores]);

  const getRoomName = (roomId) => {
    const room = classrooms.find(
      (item) => item.room_id === roomId
    );

    return (
      room?.room_name ||
      `Room ${roomId}`
    );
  };

  const getDeviceName = (deviceId) => {
    if (!deviceId) {
      return "Room-level";
    }

    const device = devices.find(
      (item) => item.device_id === deviceId
    );

    return (
      device?.device_name ||
      `Device ${deviceId}`
    );
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const monitoredTotal = healthScores.length || 1;

  const overviewRows = [
    { label: "Active classrooms", hint: "Currently operational", value: activeClassrooms.length, total: classrooms.length, icon: "classroom", tone: "brand" },
    { label: "Active devices", hint: "Connected infrastructure", value: activeDevices.length, total: devices.length, icon: "device", tone: "info" },
    { label: "Active users", hint: "Accounts with access", value: activeUsers.length, total: users.length, icon: "users", tone: "violet" },
  ];

  // Load failed and nothing to show: KPI cards display "—" instead of misleading zeros.

  const loadFailed = Boolean(error) && classrooms.length === 0;


  return (
    <AppShell
      eyebrow="Administration"
      title="Dashboard"
      actions={<RefreshButton onClick={loadDashboardData} loading={loading} />}
    >
      {/* WELCOME */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-1.5">Infrastructure overview</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {greeting}, {adminName.split(" ")[0]}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Classrooms, devices, users and calibration across the SIMMS network.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigateTo("/admin/devices")} className="btn btn-secondary">
            <Icon name="device" className="h-4 w-4" />
            Devices
          </button>
          <button type="button" onClick={() => navigateTo("/admin/rooms")} className="btn btn-primary">
            <Icon name="classroom" className="h-4 w-4" />
            Manage classrooms
          </button>
        </div>
      </div>

      {error && (
        <Alert tone="danger" title="Dashboard data could not be loaded" onRetry={loadDashboardData} className="mb-6">
          {error}
        </Alert>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* KPIs */}
          <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              unavailable={loadFailed}
              label="Classrooms"
              value={classrooms.length}
              hint={`${activeClassrooms.length} active`}
              icon="classroom"
              tone="brand"
              onClick={() => navigateTo("/admin/rooms")}
            />
            <StatCard
              unavailable={loadFailed}
              label="Devices"
              value={devices.length}
              hint={`${activeDevices.length} active`}
              icon="device"
              tone="info"
              onClick={() => navigateTo("/admin/devices")}
            />
            <StatCard
              unavailable={loadFailed}
              label="Active faults"
              value={faults.length}
              hint={faults.length > 0 ? "Confirmed and awaiting resolution" : "No confirmed faults"}
              icon="alert"
              tone={faults.length > 0 ? "danger" : "success"}
            />
            <StatCard
              unavailable={loadFailed}
              label="Open tickets"
              value={openTickets.length}
              hint={openTickets.length > 0 ? "Maintenance attention required" : "Queue is clear"}
              icon="ticket"
              tone={openTickets.length > 0 ? "warning" : "success"}
            />
          </section>

          {/* HEALTH + OVERVIEW */}
          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card
              title="Classroom health"
              subtitle="Latest score calculated from monitoring data"
              icon="heart"
              bodyClassName=""
              actions={
                <span className="num rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                  {healthScores.length} monitored
                </span>
              }
            >
              {/* Distribution */}
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Health distribution: ${healthSummary.excellent} excellent, ${healthSummary.good} good, ${healthSummary.warning} warning, ${healthSummary.critical} critical`}>
                  {HEALTH_SEGMENTS.map((segment) =>
                    healthSummary[segment.key] > 0 ? (
                      <div
                        key={segment.key}
                        className={`${segment.bar} h-full border-r-2 border-white last:border-r-0`}
                        style={{ width: `${(healthSummary[segment.key] / monitoredTotal) * 100}%` }}
                      />
                    ) : null
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                  {HEALTH_SEGMENTS.map((segment) => (
                    <div key={segment.key} className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${segment.bar}`} aria-hidden="true" />
                      <dt className="text-xs text-slate-500">{segment.label}</dt>
                      <dd className={`num ml-auto text-sm font-semibold sm:ml-0 ${segment.text}`}>{healthSummary[segment.key]}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {healthScores.length === 0 ? (
                <EmptyState icon="heart" title="No health data yet" description="Health information appears once monitoring records are generated." />
              ) : (
                <div className="table-wrap">
                  <table className="table min-w-[640px]">
                    <thead>
                      <tr>
                        <th scope="col">Classroom</th>
                        <th scope="col">Status</th>
                        <th scope="col">Score</th>
                        <th scope="col" className="text-right">Faults</th>
                        <th scope="col" className="text-right">Environment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {healthScores.slice(0, 8).map((health) => (
                        <tr key={health.room_id}>
                          <td>
                            <p className="font-semibold text-slate-900">{getRoomName(health.room_id)}</p>
                            <p className="num mt-0.5 text-[11px] text-slate-500">ID {health.room_id}</p>
                          </td>
                          <td>
                            <StatusBadge status={health.health_status} />
                          </td>
                          <td>
                            <div className="flex items-center gap-3">
                              <span className="num w-8 text-sm font-semibold text-slate-900">{health.health_score ?? "—"}</span>
                              {health.health_score != null && <ScoreBar value={health.health_score} className="w-24" />}
                            </div>
                          </td>
                          <td className="text-right">
                            <span className={`num font-semibold ${health.active_fault_count > 0 ? "text-red-600" : "text-slate-500"}`}>
                              {health.active_fault_count ?? 0}
                            </span>
                          </td>
                          <td className="text-right">
                            <p className="num text-sm font-medium text-slate-700">
                              {health.temperature != null ? `${health.temperature}°C` : "—"}
                            </p>
                            <p className="num mt-0.5 text-[11px] text-slate-500">
                              {health.humidity != null ? `${health.humidity}% RH` : "No humidity"}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="System overview" subtitle="Platform-wide availability" icon="server">
              <ul className="space-y-4">
                {overviewRows.map((row) => (
                  <li key={row.label}>
                    <div className="flex items-center gap-3">
                      <IconTile icon={row.icon} tone={row.tone} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                        <p className="text-xs text-slate-500">{row.hint}</p>
                      </div>
                      <p className="num text-sm text-slate-500">
                        <span className="text-lg font-semibold text-slate-900">{row.value}</span>
                        <span className="text-slate-400"> / {row.total}</span>
                      </p>
                    </div>
                    <ScoreBar value={row.total ? (row.value / row.total) * 100 : 0} tone={row.tone} className="mt-2.5" />
                  </li>
                ))}
              </ul>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="eyebrow mb-3">Quick actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Manage users", icon: "users", path: "/admin/users" },
                    { label: "Calibration", icon: "calibration", path: "/admin/calibration" },
                    { label: "Classrooms", icon: "classroom", path: "/admin/rooms" },
                    { label: "Devices", icon: "device", path: "/admin/devices" },
                  ].map((action) => (
                    <button
                      key={action.path}
                      type="button"
                      onClick={() => navigateTo(action.path)}
                      className="group flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-[13px] font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50/60 hover:text-brand-700"
                    >
                      <Icon name={action.icon} className="h-4 w-4 text-slate-400 group-hover:text-brand-600" />
                      <span className="truncate">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </section>

          {/* ACTIVE FAULTS */}
          <Card
            className="mt-6"
            title="Active faults"
            subtitle="Confirmed infrastructure faults currently reported"
            icon="alert"
            bodyClassName=""
            actions={
              faults.length > 0 ? (
                <StatusBadge tone="danger" label={`${faults.length} active`} />
              ) : (
                loadFailed ? null : <StatusBadge tone="success" label="All clear" />
              )
            }
          >
            {faults.length === 0 ? (
              <EmptyState icon={loadFailed ? "wifiOff" : "checkCircle"} title={loadFailed ? "Faults unavailable" : "No active faults"} description={loadFailed ? "Fault data could not be loaded. Retry once the backend is reachable." : "The monitoring system reports no confirmed faults right now."} />
            ) : (
              <ul className="grid divide-y divide-slate-100 lg:grid-cols-2 lg:divide-y-0">
                {faults.slice(0, 6).map((fault, index) => (
                  <li
                    key={fault.fault_id}
                    className={`flex items-start gap-3 px-5 py-4 ${index >= 2 ? "lg:border-t lg:border-slate-100" : ""} ${index % 2 === 1 ? "lg:border-l lg:border-slate-100" : ""}`}
                  >
                    <IconTile icon="alert" tone="danger" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-slate-900">{formatLabel(fault.fault_type)}</p>
                        <StatusBadge status={fault.status} size="sm" />
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{getRoomName(fault.room_id)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{getDeviceName(fault.device_id)}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Icon name="clock" className="h-3 w-3" />
                          {formatDate(fault.detected_at)}
                        </span>
                        <span className="num font-medium text-slate-700">
                          {fault.confidence != null ? `${formatConfidence(fault.confidence)} conf.` : "Conf. —"}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* TICKETS + USERS */}
          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card title="Recent tickets" subtitle="Latest maintenance records" icon="ticket" bodyClassName="">
              {tickets.length === 0 ? (
                <EmptyState icon="ticket" title="No tickets yet" description="Ticket records appear here when faults are escalated." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {tickets.slice(0, 6).map((ticket) => (
                    <li key={ticket.ticket_id} className="flex items-center gap-3 px-5 py-3.5">
                      <IconTile icon="ticket" tone="neutral" className="h-8 w-8" />
                      <div className="min-w-0 flex-1">
                        <p className="num text-sm font-semibold text-slate-900">Ticket #{ticket.ticket_id}</p>
                        <p className="num text-xs text-slate-500">Fault #{ticket.fault_id}</p>
                      </div>
                      {ticket.priority && <StatusBadge status={ticket.priority} dot={false} size="sm" />}
                      <StatusBadge status={ticket.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="System users"
              subtitle="Accounts registered on the platform"
              icon="users"
              bodyClassName=""
              actions={
                <button type="button" onClick={() => navigateTo("/admin/users")} className="btn btn-sm btn-ghost">
                  View all
                  <Icon name="arrowRight" className="h-3.5 w-3.5" />
                </button>
              }
            >
              {users.length === 0 ? (
                <EmptyState icon="users" title="No users available" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {users.slice(0, 6).map((user) => (
                    <li key={user.user_id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 ring-1 ring-slate-200">
                        {user.name?.charAt(0).toUpperCase() || "U"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{user.name || "—"}</p>
                        <p className="truncate text-xs text-slate-500">{user.email || "—"}</p>
                      </div>
                      <span className="hidden text-xs font-medium text-slate-500 sm:inline">{formatLabel(user.role)}</span>
                      <StatusBadge status={user.is_active ? "ACTIVE" : "INACTIVE"} size="sm" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </>
      )}
    </AppShell>
  );
}
