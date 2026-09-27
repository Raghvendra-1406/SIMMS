import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  DetailItem,
  EmptyState,
  IconTile,
  RefreshButton,
  ScoreBar,
  StatCard,
  StatusBadge,
} from "../../components/ui";
import { formatLabel } from "../../lib/format";
import { navigateTo } from "../../lib/session";

const API_BASE_URL = "http://localhost:8000";

function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getDisplayValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return `${value}${suffix}`;
}

function getFaultTypeLabel(faultType) {
  const labels = {
    FAN_FAILURE: "Fan failure",
    LIGHTS_LEFT_ON: "Lights left on",
    ELECTRICAL_ABNORMALITY: "Electrical abnormality",
  };

  return labels[faultType] || String(faultType || "Unknown").replaceAll("_", " ");
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

function formatObservationData(data) {
  return typeof data === "object" ? JSON.stringify(data, null, 2) : String(data ?? "—");
}

function DetailsSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading classroom information…</span>
      <div className="card p-5 sm:p-6">
        <span className="skeleton block h-5 w-40" />
        <span className="skeleton mt-4 block h-7 w-64" />
        <span className="skeleton mt-3 block h-3 w-48" />
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card p-5">
            <span className="skeleton block h-3 w-24" />
            <span className="skeleton mt-3 block h-8 w-16" />
            <span className="skeleton mt-3 block h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="card h-80 p-5">
          <span className="skeleton block h-4 w-32" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index} className="skeleton block h-12 w-full" />
            ))}
          </div>
        </div>
        <div className="card h-80 p-5">
          <span className="skeleton block h-4 w-32" />
          <div className="mt-6 grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index} className="skeleton block h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ObservationList({ items, getKey, emptyTitle, emptyDescription, icon }) {
  if (items.length === 0) {
    return <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} className="py-10" />;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item, index) => (
        <li key={getKey(item) || index} className="px-5 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-700">{formatLabel(item.observation_type)}</p>
            <span className="num flex items-center gap-1 text-[11px] text-slate-500">
              <Icon name="clock" className="h-3 w-3" />
              {formatDateTime(item.observed_at)}
            </span>
          </div>
          <pre className="num thin-scrollbar mt-2.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-100 bg-slate-50 p-3 text-[11px] leading-5 text-slate-700">
            {formatObservationData(item.observation_data)}
          </pre>
        </li>
      ))}
    </ul>
  );
}

export default function SupervisorClassroomDetails() {
  const [classroom, setClassroom] = useState(null);

  const [devices, setDevices] = useState([]);
  const [health, setHealth] = useState(null);
  const [faults, setFaults] = useState([]);
  const [sensorData, setSensorData] = useState([]);
  const [visionData, setVisionData] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const roomId = useMemo(() => {
    const pathParts = window.location.pathname.split("/");
    const roomIndex = pathParts.indexOf("classrooms");

    if (roomIndex === -1 || !pathParts[roomIndex + 1]) {
      return null;
    }

    const parsed = Number(pathParts[roomIndex + 1]);

    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  useEffect(() => {
    if (roomId === null) {
      setError("Invalid classroom ID.");
      setLoading(false);
      return;
    }

    loadClassroomData();
  }, [roomId]);

  async function fetchApi(endpoint) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      let message = `Request failed with status ${response.status}.`;

      try {
        const data = await response.json();

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

  async function loadClassroomData() {
    if (roomId === null) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        fetchApi(`/classrooms/${roomId}`),
        fetchApi(`/devices/room/${roomId}`),
        fetchApi("/health/classrooms"),
        fetchApi(`/faults/room/${roomId}/active`),
        fetchApi(`/sensors/room/${roomId}/latest`),
        fetchApi(`/vision/room/${roomId}/latest`),
      ]);

      const [classroomResult, devicesResult, healthResult, faultsResult, sensorsResult, visionResult] = results;

      if (classroomResult.status === "rejected") {
        throw classroomResult.reason;
      }

      setClassroom(classroomResult.value);

      if (devicesResult.status === "fulfilled") {
        setDevices(Array.isArray(devicesResult.value) ? devicesResult.value : []);
      } else {
        setDevices([]);
      }

      if (healthResult.status === "fulfilled") {
        const healthRows = Array.isArray(healthResult.value) ? healthResult.value : [];

        const matchingHealth = healthRows.find((item) => Number(item.room_id) === Number(roomId));

        setHealth(matchingHealth || null);
      } else {
        setHealth(null);
      }

      if (faultsResult.status === "fulfilled") {
        setFaults(Array.isArray(faultsResult.value) ? faultsResult.value : []);
      } else {
        setFaults([]);
      }

      if (sensorsResult.status === "fulfilled") {
        setSensorData(
          Array.isArray(sensorsResult.value)
            ? sensorsResult.value
            : sensorsResult.value
              ? [sensorsResult.value]
              : []
        );
      } else {
        setSensorData([]);
      }

      if (visionResult.status === "fulfilled") {
        setVisionData(
          Array.isArray(visionResult.value)
            ? visionResult.value
            : visionResult.value
              ? [visionResult.value]
              : []
        );
      } else {
        setVisionData([]);
      }

      const optionalFailures = results.filter((result) => result.status === "rejected").length;

      if (optionalFailures > 0) {
        console.warn("Some classroom monitoring endpoints were unavailable.");
      }
    } catch (err) {
      setError(err.message || "Unable to load classroom information.");
    } finally {
      setLoading(false);
    }
  }

  const activeDevices = devices.filter(
    (device) => String(device.status || "").toUpperCase() === "ACTIVE"
  ).length;

  const healthStatus = health?.health_status || null;

  const totalFaults =
    health?.active_fault_count !== undefined && health?.active_fault_count !== null
      ? health.active_fault_count
      : faults.length;

  const pageTitle = classroom?.room_name || (roomId ? `Room ${roomId}` : "Classroom");

  // Load failed and nothing to show: KPI cards display "—" instead of misleading zeros.

  const loadFailed = Boolean(error) && !classroom;


  return (
    <AppShell
      eyebrow="Classrooms"
      title={pageTitle}
      backHref="/supervisor/classrooms"
      actions={<RefreshButton onClick={loadClassroomData} loading={loading} />}
    >
      {error && (
        <Alert tone="danger" title="Unable to load classroom information" onRetry={loadClassroomData} className="mb-6">
          {error}
        </Alert>
      )}

      {loading ? (
        <DetailsSkeleton />
      ) : classroom ? (
        <>
          {/* SUMMARY */}
          <section className="card p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <IconTile icon="classroom" tone="brand" className="h-11 w-11" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={classroom.status || "UNKNOWN"} />
                    {health ? (
                      <StatusBadge status={healthStatus} label={`Health: ${formatLabel(healthStatus)}`} />
                    ) : (
                      <StatusBadge tone="neutral" label="No health data" />
                    )}
                  </div>
                  <h2 className="mt-2.5 truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    {classroom.room_name || `Room ${classroom.room_id}`}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    <span className="num">Classroom ID {classroom.room_id}</span>
                    {classroom.room_type ? ` · ${classroom.room_type}` : ""}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-3 sm:gap-6 lg:shrink-0">
                <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:px-4">
                  <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <Icon name="building" className="h-3.5 w-3.5" />
                    Building
                  </dt>
                  <dd className="mt-1 truncate text-sm font-semibold text-slate-900">{classroom.building || "—"}</dd>
                </div>
                <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:px-4">
                  <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <Icon name="layers" className="h-3.5 w-3.5" />
                    Floor
                  </dt>
                  <dd className="num mt-1 text-sm font-semibold text-slate-900">{getDisplayValue(classroom.floor)}</dd>
                </div>
                <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:px-4">
                  <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <Icon name="users" className="h-3.5 w-3.5" />
                    Capacity
                  </dt>
                  <dd className="num mt-1 text-sm font-semibold text-slate-900">{getDisplayValue(classroom.capacity)}</dd>
                </div>
              </dl>
            </div>
          </section>

          {/* KPIs */}
          <section aria-label="Classroom metrics" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              unavailable={loadFailed}
              label="Health score"
              value={health ? getDisplayValue(health.health_score) : "—"}
              hint={health ? formatLabel(healthStatus) : "No health calculation available"}
              icon="heart"
              tone={
                !health
                  ? "neutral"
                  : String(healthStatus).toUpperCase() === "CRITICAL"
                    ? "danger"
                    : String(healthStatus).toUpperCase() === "WARNING"
                      ? "warning"
                      : "success"
              }
              footer={health && health.health_score != null ? <ScoreBar value={health.health_score} /> : null}
            />
            <StatCard
              unavailable={loadFailed}
              label="Occupancy"
              value={health ? getDisplayValue(health.occupancy_count) : "—"}
              hint="Detected people"
              icon="users"
              tone="violet"
            />
            <StatCard
              unavailable={loadFailed}
              label="Active faults"
              value={totalFaults}
              hint="Confirmed active faults"
              icon="alert"
              tone={Number(totalFaults) > 0 ? "danger" : "success"}
            />
            <StatCard
              unavailable={loadFailed}
              label="Active devices"
              value={`${activeDevices}/${devices.length}`}
              hint="Configured devices"
              icon="device"
              tone="info"
            />
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {/* LEFT */}
            <div className="flex min-w-0 flex-col gap-6">
              <Card
                title="Active faults"
                subtitle="Confirmed faults associated with this classroom"
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
                  <EmptyState
                    icon={loadFailed ? "wifiOff" : "checkCircle"}
                    title={loadFailed ? "Faults unavailable" : "No active faults"}
                    description={loadFailed ? "Fault data could not be loaded. Retry once the backend is reachable." : "No confirmed active faults are currently associated with this classroom."}
                  />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {faults.map((fault) => (
                      <li key={fault.fault_id}>
                        <button
                          type="button"
                          onClick={() => navigateTo(`/supervisor/faults/${fault.fault_id}`)}
                          className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50"
                        >
                          <IconTile icon="alert" tone="danger" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="text-sm font-semibold text-slate-900">{getFaultTypeLabel(fault.fault_type)}</p>
                              <span className="num text-[11px] text-slate-500">Fault #{fault.fault_id}</span>
                            </div>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                              <span className="font-medium text-slate-700">
                                {fault.device_id ? `Device #${fault.device_id}` : "Room-level fault"}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="flex items-center gap-1">
                                <Icon name="clock" className="h-3 w-3" />
                                Detected {formatDateTime(fault.detected_at)}
                              </span>
                            </p>
                          </div>
                          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-700">
                            <span className="hidden sm:inline">View</span>
                            <Icon name="chevronRight" className="h-4 w-4 text-slate-400 group-hover:text-brand-600" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card
                title="Devices"
                subtitle="Infrastructure installed in this classroom"
                icon="device"
                bodyClassName=""
                actions={
                  <span className="num rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                    {devices.length} total
                  </span>
                }
              >
                {devices.length === 0 ? (
                  <EmptyState
                    icon="device"
                    title="No devices configured"
                    description="No devices are currently assigned to this classroom."
                  />
                ) : (
                  <div className="table-wrap">
                    <table className="table min-w-[600px]">
                      <thead>
                        <tr>
                          <th scope="col">Device</th>
                          <th scope="col">Type</th>
                          <th scope="col">Status</th>
                          <th scope="col">Last seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {devices.map((device) => (
                          <tr key={device.device_id}>
                            <td>
                              <p className="font-semibold text-slate-900">
                                {device.device_name || `Device ${device.device_id}`}
                              </p>
                              <p className="num mt-0.5 text-[11px] text-slate-500">ID {device.device_id}</p>
                            </td>
                            <td>
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {formatLabel(device.device_type)}
                              </span>
                            </td>
                            <td>
                              <StatusBadge status={device.status || "UNKNOWN"} />
                            </td>
                            <td className="num text-xs text-slate-500">{formatDateTime(device.last_seen)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            {/* RIGHT */}
            <div className="flex min-w-0 flex-col gap-6">
              <Card title="Environment" subtitle="Current classroom conditions" icon="thermometer">
                <dl className="grid grid-cols-3 gap-x-4 gap-y-4">
                  <DetailItem label="Temperature" mono>
                    {health ? getDisplayValue(health.temperature, "°C") : "—"}
                  </DetailItem>
                  <DetailItem label="Humidity" mono>
                    {health ? getDisplayValue(health.humidity, "%") : "—"}
                  </DetailItem>
                  <DetailItem label="Power" mono>
                    {health ? getDisplayValue(health.power, " W") : "—"}
                  </DetailItem>
                </dl>
                <p className="mt-5 flex items-center gap-1.5 border-t border-slate-100 pt-4 text-xs text-slate-500">
                  <Icon name="clock" className="h-3.5 w-3.5" />
                  Last calculation
                  <span className="num font-medium text-slate-700">
                    {health ? formatDateTime(health.calculated_at) : "—"}
                  </span>
                </p>
              </Card>

              <Card title="Sensor observations" subtitle="Latest sensor monitoring data" icon="cpu" bodyClassName="">
                <ObservationList
                  items={sensorData}
                  getKey={(sensor) => sensor.observation_id}
                  icon="cpu"
                  emptyTitle="No sensor observation"
                  emptyDescription="No latest sensor data is available."
                />
              </Card>

              <Card title="Vision observations" subtitle="Latest vision monitoring data" icon="camera" bodyClassName="">
                <ObservationList
                  items={visionData}
                  getKey={(vision) => vision.vision_observation_id}
                  icon="camera"
                  emptyTitle="No vision observation"
                  emptyDescription="No latest vision data is available."
                />
              </Card>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <EmptyState
            icon="classroom"
            title="Classroom not found"
            description="This classroom could not be loaded. It may have been removed or the link is invalid."
            action={
              <button type="button" onClick={() => navigateTo("/supervisor/classrooms")} className="btn btn-primary">
                <Icon name="arrowLeft" className="h-4 w-4" />
                Back to classrooms
              </button>
            }
          />
        </div>
      )}
    </AppShell>
  );
}
