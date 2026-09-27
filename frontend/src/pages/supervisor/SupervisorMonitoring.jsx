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
  SkeletonRows,
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

function isEmptyValue(value) {
  return value === null || value === undefined || value === "";
}

function getFaultTypeLabel(faultType) {
  const labels = {
    FAN_FAILURE: "Fan failure",
    LIGHTS_LEFT_ON: "Lights left on",
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

// Units for known observation fields (display only).
const FIELD_UNITS = {
  temperature: "°C",
  humidity: "%",
  voltage: "V",
  current: "A",
  fan_current: "A",
  power: "W",
};

const OBSERVATION_ICONS = {
  ELECTRICAL: "zap",
  ENVIRONMENT: "thermometer",
  LIGHT: "lightbulb",
  ENERGY: "power",
  OCCUPANCY: "users",
  FAN_MOTION: "fan",
  SENSOR: "cpu",
  VISION: "camera",
};

/** Sensor reading: tabular value with a muted unit. */
function Reading({ value, unit, className = "" }) {
  if (isEmptyValue(value)) {
    return <span className={`num text-slate-400 ${className}`}>—</span>;
  }

  return (
    <span className={`num text-slate-900 ${className}`}>
      {value}
      {unit && <span className="ml-0.5 text-[0.75em] font-normal text-slate-500">{unit}</span>}
    </span>
  );
}

function formatFieldValue(value) {
  if (typeof value === "boolean") {
    return value ? "On" : "Off";
  }

  if (typeof value === "number" && !Number.isInteger(value)) {
    return Number(value.toFixed(2));
  }

  return value;
}

function ObservationCard({
  observation,
  type,
  roomName,
}) {
  const data =
    observation?.observation_data;

  const observationType =
    observation?.observation_type ||
    type;

  const isFlatObject =
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    Object.values(data).every(
      (value) =>
        value === null ||
        typeof value !== "object"
    );

  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        <IconTile
          icon={OBSERVATION_ICONS[String(observationType).toUpperCase()] || OBSERVATION_ICONS[type]}
          tone={type === "VISION" ? "violet" : "info"}
          className="h-8 w-8"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {formatLabel(observationType)}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{roomName}</span>
                <span aria-hidden="true">·</span>
                <span className="num">Device #{observation?.device_id ?? "—"}</span>
              </p>
            </div>

            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Icon name="clock" className="h-3 w-3" />
              <span className="num">{formatDateTime(observation?.observed_at)}</span>
            </span>
          </div>

          {isFlatObject ? (
            Object.keys(data).length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No values reported.</p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(data).map(([key, value]) => (
                  <div key={key} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                    <dt className="truncate text-[11px] font-medium text-slate-500">{formatLabel(key)}</dt>
                    <dd className="mt-0.5 text-sm font-semibold">
                      <Reading value={formatFieldValue(value)} unit={FIELD_UNITS[key]} />
                    </dd>
                  </div>
                ))}
              </dl>
            )
          ) : typeof data === "object" &&
            data !== null ? (
            <pre className="thin-scrollbar num mt-3 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-[11.5px] leading-5 text-slate-700">
              {JSON.stringify(
                data,
                null,
                2
              )}
            </pre>
          ) : (
            <p className="mt-2 text-sm">
              <Reading value={data} />
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function HealthGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading monitoring data…</span>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="card p-5">
          <span className="skeleton block h-4 w-32" />
          <span className="skeleton mt-2 block h-3 w-16" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <span className="skeleton block h-14 w-full" />
            <span className="skeleton block h-14 w-full" />
          </div>
          <span className="skeleton mt-4 block h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function SupervisorMonitoring() {
  const [classrooms, setClassrooms] =
    useState([]);

  const [healthData, setHealthData] =
    useState([]);

  const [faults, setFaults] =
    useState([]);

  const [sensorObservations, setSensorObservations] =
    useState([]);

  const [visionObservations, setVisionObservations] =
    useState([]);

  const [selectedRoomId, setSelectedRoomId] =
    useState("ALL");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState(null);

  useEffect(() => {
    loadMonitoringData();
  }, []);

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

  async function loadMonitoringData() {
    setLoading(true);
    setError("");

    try {
      const [
        classroomsResult,
        healthResult,
        faultsResult,
      ] = await Promise.all([
        fetchApi("/classrooms"),
        fetchApi("/health/classrooms"),
        fetchApi("/faults/active"),
      ]);

      const classroomRows =
        Array.isArray(classroomsResult)
          ? classroomsResult
          : [];

      setClassrooms(
        classroomRows
      );

      setHealthData(
        Array.isArray(healthResult)
          ? healthResult
          : []
      );

      setFaults(
        Array.isArray(faultsResult)
          ? faultsResult
          : []
      );

      /*
       * Sensor and vision APIs are room-specific.
       * Fetch latest observations for every configured
       * classroom in parallel.
       */
      const sensorRequests =
        classroomRows.map(
          async (classroom) => {
            const roomId =
              classroom.room_id;

            try {
              const data =
                await fetchApi(
                  `/sensors/room/${roomId}/latest`
                );

              return Array.isArray(data)
                ? data.map((item) => ({
                    ...item,
                    room_id: roomId,
                  }))
                : data
                  ? [
                      {
                        ...data,
                        room_id: roomId,
                      },
                    ]
                  : [];
            } catch {
              return [];
            }
          }
        );

      const visionRequests =
        classroomRows.map(
          async (classroom) => {
            const roomId =
              classroom.room_id;

            try {
              const data =
                await fetchApi(
                  `/vision/room/${roomId}/latest`
                );

              return Array.isArray(data)
                ? data.map((item) => ({
                    ...item,
                    room_id: roomId,
                  }))
                : data
                  ? [
                      {
                        ...data,
                        room_id: roomId,
                      },
                    ]
                  : [];
            } catch {
              return [];
            }
          }
        );

      const [
        sensorResults,
        visionResults,
      ] = await Promise.all([
        Promise.all(sensorRequests),
        Promise.all(visionRequests),
      ]);

      setSensorObservations(
        sensorResults.flat()
      );

      setVisionObservations(
        visionResults.flat()
      );

      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err.message ||
          "Unable to load monitoring data."
      );
    } finally {
      setLoading(false);
    }
  }

  const healthByRoom = useMemo(() => {
    const map = new Map();

    healthData.forEach((health) => {
      if (health?.room_id !== undefined) {
        map.set(
          Number(health.room_id),
          health
        );
      }
    });

    return map;
  }, [healthData]);

  const filteredHealth = useMemo(() => {
    if (selectedRoomId === "ALL") {
      return healthData;
    }

    return healthData.filter(
      (health) =>
        Number(health.room_id) ===
        Number(selectedRoomId)
    );
  }, [
    healthData,
    selectedRoomId,
  ]);

  const filteredFaults = useMemo(() => {
    if (selectedRoomId === "ALL") {
      return faults;
    }

    return faults.filter(
      (fault) =>
        Number(fault.room_id) ===
        Number(selectedRoomId)
    );
  }, [
    faults,
    selectedRoomId,
  ]);

  const filteredSensors = useMemo(() => {
    if (selectedRoomId === "ALL") {
      return sensorObservations;
    }

    return sensorObservations.filter(
      (observation) =>
        Number(observation.room_id) ===
        Number(selectedRoomId)
    );
  }, [
    sensorObservations,
    selectedRoomId,
  ]);

  const filteredVision = useMemo(() => {
    if (selectedRoomId === "ALL") {
      return visionObservations;
    }

    return visionObservations.filter(
      (observation) =>
        Number(observation.room_id) ===
        Number(selectedRoomId)
    );
  }, [
    visionObservations,
    selectedRoomId,
  ]);

  const totalPeople = useMemo(() => {
    return filteredHealth.reduce(
      (total, health) =>
        total +
        Number(
          health.occupancy_count || 0
        ),
      0
    );
  }, [filteredHealth]);

  const averageTemperature =
    useMemo(() => {
      const values =
        filteredHealth
          .map((item) =>
            Number(item.temperature)
          )
          .filter((value) =>
            Number.isFinite(value)
          );

      if (values.length === 0) {
        return null;
      }

      return (
        values.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / values.length
      );
    }, [filteredHealth]);

  const averageHumidity =
    useMemo(() => {
      const values =
        filteredHealth
          .map((item) =>
            Number(item.humidity)
          )
          .filter((value) =>
            Number.isFinite(value)
          );

      if (values.length === 0) {
        return null;
      }

      return (
        values.reduce(
          (sum, value) =>
            sum + value,
          0
        ) / values.length
      );
    }, [filteredHealth]);

  const getRoomName = (roomId) => {
    const classroom = classrooms.find(
      (room) =>
        Number(room.room_id) ===
        Number(roomId)
    );

    return (
      classroom?.room_name ||
      `Room ${roomId}`
    );
  };

  const scopeLabel =
    selectedRoomId === "ALL"
      ? "All classrooms"
      : getRoomName(selectedRoomId);

  const connectionOk = !error && !loading;

  return (
    <AppShell
      eyebrow="Overview"
      title="Monitoring"
      actions={
        <RefreshButton
          onClick={loadMonitoringData}
          loading={loading}
        />
      }
    >
      {/* TOOLBAR */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">Current sensor and vision information</p>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Infrastructure monitoring
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
            Latest classroom conditions, occupancy, sensor and vision observations, and confirmed faults.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <div
            className="flex flex-wrap items-center gap-2 text-xs text-slate-500"
            role="status"
            aria-live="polite"
          >
            {loading ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-300" aria-hidden="true" />
                Syncing…
              </span>
            ) : connectionOk ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
                <Icon name="wifiOff" className="h-3.5 w-3.5" />
                Disconnected
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" className="h-3 w-3" />
              Updated{" "}
              <span className="num font-medium text-slate-700">
                {lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="monitoring-room" className="text-[13px] font-medium text-slate-600">
              Classroom
            </label>
            <select
              id="monitoring-room"
              value={selectedRoomId}
              onChange={(event) =>
                setSelectedRoomId(
                  event.target.value
                )
              }
              className="select w-auto min-w-0 max-w-[220px]"
            >
              <option value="ALL">
                All classrooms
              </option>

              {classrooms.map(
                (classroom) => (
                  <option
                    key={
                      classroom.room_id
                    }
                    value={
                      classroom.room_id
                    }
                  >
                    {classroom.room_name ||
                      `Room ${classroom.room_id}`}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <Alert
          tone="danger"
          title="Monitoring data could not be loaded"
          onRetry={loadMonitoringData}
          className="mb-6"
        >
          {error}
        </Alert>
      )}

      {/* KPIs */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Classrooms"
          value={
            selectedRoomId === "ALL"
              ? classrooms.length
              : 1
          }
          hint={`Monitoring scope · ${scopeLabel}`}
          icon="classroom"
          tone="brand"
          loading={loading}
        />
        <StatCard
          label="Occupancy"
          value={totalPeople}
          hint="Detected people"
          icon="users"
          tone="violet"
          loading={loading}
        />
        <StatCard
          label="Avg. temperature"
          value={
            averageTemperature !== null ? (
              <>
                {averageTemperature.toFixed(1)}
                <span className="ml-1 text-base font-medium text-slate-500">°C</span>
              </>
            ) : (
              "—"
            )
          }
          hint={
            averageHumidity !== null
              ? `Avg. humidity ${averageHumidity.toFixed(1)}%`
              : "Average available reading"
          }
          icon="thermometer"
          tone="info"
          loading={loading}
        />
        <StatCard
          label="Active faults"
          value={filteredFaults.length}
          hint={
            filteredFaults.length > 0
              ? "Confirmed active faults"
              : "No confirmed faults"
          }
          icon="alert"
          tone={filteredFaults.length > 0 ? "danger" : "success"}
          loading={loading}
        />
      </section>

      {/* HEALTH */}
      <section className="mt-6" aria-labelledby="classroom-health-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">Current condition</p>
            <h3 id="classroom-health-heading" className="text-base font-semibold tracking-tight text-slate-900">
              Classroom health
            </h3>
          </div>

          <span className="hidden text-xs text-slate-500 sm:block">
            Latest available health records
          </span>
        </div>

        {loading ? (
          <HealthGridSkeleton />
        ) : filteredHealth.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="heart"
              title="No health data available"
              description="No calculated health record is currently available for the selected classroom."
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredHealth.map((item) => {
              const health =
                healthByRoom.get(Number(item.room_id)) || item;

              return (
                <button
                  type="button"
                  key={item.room_id}
                  onClick={() =>
                    navigateTo(
                      `/supervisor/classrooms/${item.room_id}`
                    )
                  }
                  className="card card-hover flex w-full flex-col p-5 text-left"
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {getRoomName(item.room_id)}
                      </p>
                      <p className="num mt-0.5 text-[11px] text-slate-500">
                        Room #{item.room_id}
                      </p>
                    </div>

                    <StatusBadge status={health.health_status || "UNKNOWN"} />
                  </div>

                  <div className="mt-4 grid w-full grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-slate-500">Score</p>
                      <p className="mt-0.5 text-xl font-semibold leading-tight">
                        <Reading value={health.health_score} />
                      </p>
                      {!isEmptyValue(health.health_score) && (
                        <ScoreBar value={health.health_score} className="mt-2" />
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                      <p className="text-[11px] font-medium text-slate-500">Occupancy</p>
                      <p className="mt-0.5 text-xl font-semibold leading-tight">
                        <Reading
                          value={health.occupancy_count}
                          unit={isEmptyValue(health.occupancy_count) ? "" : "ppl"}
                        />
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 grid w-full grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                    {[
                      { label: "Temp", icon: "thermometer", value: health.temperature, unit: "°C" },
                      { label: "Humidity", icon: "gauge", value: health.humidity, unit: "%" },
                      { label: "Power", icon: "zap", value: health.power, unit: "W" },
                    ].map((metric) => (
                      <div key={metric.label} className="min-w-0">
                        <dt className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                          <Icon name={metric.icon} className="h-3 w-3" />
                          {metric.label}
                        </dt>
                        <dd className="mt-0.5 truncate text-sm font-semibold">
                          <Reading value={metric.value} unit={metric.unit} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* SENSOR + VISION */}
      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card
          title="Sensor observations"
          subtitle="Latest IoT readings per classroom"
          icon="cpu"
          bodyClassName=""
          actions={
            <span className="num rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
              {filteredSensors.length}
            </span>
          }
        >
          {loading ? (
            <SkeletonRows rows={3} />
          ) : filteredSensors.length === 0 ? (
            <EmptyState
              icon="cpu"
              title="No sensor observations"
              description="No latest sensor information is available."
            />
          ) : (
            <ul className="thin-scrollbar max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
              {filteredSensors.map(
                (observation, index) => (
                  <ObservationCard
                    key={
                      observation.observation_id ||
                      `${observation.room_id}-${index}`
                    }
                    observation={
                      observation
                    }
                    type="SENSOR"
                    roomName={getRoomName(observation.room_id)}
                  />
                )
              )}
            </ul>
          )}
        </Card>

        <Card
          title="Vision observations"
          subtitle="Latest camera detections per classroom"
          icon="camera"
          bodyClassName=""
          actions={
            <span className="num rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
              {filteredVision.length}
            </span>
          }
        >
          {loading ? (
            <SkeletonRows rows={3} />
          ) : filteredVision.length === 0 ? (
            <EmptyState
              icon="camera"
              title="No vision observations"
              description="No latest vision information is available."
            />
          ) : (
            <ul className="thin-scrollbar max-h-[560px] divide-y divide-slate-100 overflow-y-auto">
              {filteredVision.map(
                (observation, index) => (
                  <ObservationCard
                    key={
                      observation.vision_observation_id ||
                      `${observation.room_id}-${index}`
                    }
                    observation={
                      observation
                    }
                    type="VISION"
                    roomName={getRoomName(observation.room_id)}
                  />
                )
              )}
            </ul>
          )}
        </Card>
      </section>

      {/* ACTIVE FAULTS */}
      <Card
        className="mt-6"
        title="Active faults"
        subtitle="Confirmed faults in the selected monitoring scope"
        icon="alert"
        bodyClassName=""
        actions={
          filteredFaults.length > 0 ? (
            <StatusBadge tone="danger" label={`${filteredFaults.length} active`} />
          ) : (
            <StatusBadge tone="success" label="All clear" />
          )
        }
      >
        {loading ? (
          <SkeletonRows rows={2} />
        ) : filteredFaults.length === 0 ? (
          <EmptyState
            icon="checkCircle"
            title="No active faults"
            description="No confirmed active faults are currently in the selected monitoring scope."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredFaults.map((fault) => (
              <li key={fault.fault_id}>
                <button
                  type="button"
                  onClick={() =>
                    navigateTo(
                      `/supervisor/faults/${fault.fault_id}`
                    )
                  }
                  className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50"
                >
                  <IconTile icon="alert" tone="danger" className="h-8 w-8" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {getFaultTypeLabel(fault.fault_type)}
                      </p>
                      <span className="num text-[11px] text-slate-500">
                        Fault #{fault.fault_id}
                      </span>
                    </div>

                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        {getRoomName(fault.room_id)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="num">
                        {fault.device_id
                          ? `Device #${fault.device_id}`
                          : "Room-level fault"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Detected{" "}
                        <span className="num">{formatDateTime(fault.detected_at)}</span>
                      </span>
                    </p>
                  </div>

                  <span className="hidden shrink-0 items-center gap-1 text-[13px] font-semibold text-brand-700 sm:inline-flex">
                    View
                    <Icon name="chevronRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-slate-400 sm:hidden" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
