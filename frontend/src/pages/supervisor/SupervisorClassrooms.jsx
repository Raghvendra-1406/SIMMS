import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  EmptyState,
  RefreshButton,
  ScoreBar,
  SearchInput,
  Segmented,
  SkeletonRows,
  StatCard,
  StatusBadge,
} from "../../components/ui";
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

export default function SupervisorClassrooms() {
  const [classrooms, setClassrooms] = useState([]);
  const [healthData, setHealthData] = useState([]);
  const [faults, setFaults] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [healthFilter, setHealthFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadClassroomData();
  }, []);

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
        // Keep default error message.
      }

      throw new Error(message);
    }

    return response.json();
  }

  async function loadClassroomData() {
    setLoading(true);
    setError("");

    try {
      const [classroomResponse, healthResponse, faultResponse] = await Promise.all([
        fetchApi("/classrooms"),
        fetchApi("/health/classrooms"),
        fetchApi("/faults/active"),
      ]);

      setClassrooms(Array.isArray(classroomResponse) ? classroomResponse : []);
      setHealthData(Array.isArray(healthResponse) ? healthResponse : []);
      setFaults(Array.isArray(faultResponse) ? faultResponse : []);
    } catch (err) {
      setError(err.message || "Unable to load classroom monitoring data.");
    } finally {
      setLoading(false);
    }
  }

  const healthByRoom = useMemo(() => {
    const map = new Map();

    healthData.forEach((health) => {
      if (health?.room_id !== undefined) {
        map.set(Number(health.room_id), health);
      }
    });

    return map;
  }, [healthData]);

  const faultsByRoom = useMemo(() => {
    const map = new Map();

    faults.forEach((fault) => {
      if (fault?.room_id === undefined) {
        return;
      }

      const roomId = Number(fault.room_id);

      if (!map.has(roomId)) {
        map.set(roomId, []);
      }

      map.get(roomId).push(fault);
    });

    return map;
  }, [faults]);

  const classroomRows = useMemo(() => {
    return classrooms.map((classroom) => {
      const roomId = Number(classroom.room_id);
      const health = healthByRoom.get(roomId);
      const roomFaults = faultsByRoom.get(roomId) || [];

      return {
        ...classroom,
        health: health || null,
        roomFaults,
        activeFaultCount: health ? Number(health.active_fault_count || 0) : roomFaults.length,
      };
    });
  }, [classrooms, healthByRoom, faultsByRoom]);

  const filteredClassrooms = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return classroomRows.filter((classroom) => {
      const matchesSearch =
        !search ||
        String(classroom.room_id || "").toLowerCase().includes(search) ||
        String(classroom.room_name || "").toLowerCase().includes(search) ||
        String(classroom.building || "").toLowerCase().includes(search) ||
        String(classroom.room_type || "").toLowerCase().includes(search);

      const classroomStatus = String(classroom.status || "").toUpperCase();
      const healthStatus = String(classroom.health?.health_status || "").toUpperCase();

      const matchesStatus = statusFilter === "ALL" || classroomStatus === statusFilter;

      const matchesHealth =
        healthFilter === "ALL"
          ? true
          : healthFilter === "NO_DATA"
            ? !classroom.health
            : healthStatus === healthFilter;

      return matchesSearch && matchesStatus && matchesHealth;
    });
  }, [classroomRows, searchTerm, statusFilter, healthFilter]);

  const statistics = useMemo(() => {
    const total = classrooms.length;

    const active = classrooms.filter(
      (classroom) => String(classroom.status || "").toUpperCase() === "ACTIVE"
    ).length;

    const inactive = classrooms.filter(
      (classroom) => String(classroom.status || "").toUpperCase() === "INACTIVE"
    ).length;

    const normal = classroomRows.filter(
      (classroom) => String(classroom.health?.health_status || "").toUpperCase() === "NORMAL"
    ).length;

    const warning = classroomRows.filter(
      (classroom) => String(classroom.health?.health_status || "").toUpperCase() === "WARNING"
    ).length;

    const critical = classroomRows.filter(
      (classroom) => String(classroom.health?.health_status || "").toUpperCase() === "CRITICAL"
    ).length;

    const noHealthData = classroomRows.filter((classroom) => !classroom.health).length;

    return {
      total,
      active,
      inactive,
      normal,
      warning,
      critical,
      noHealthData,
    };
  }, [classrooms, classroomRows]);

  const filtersApplied = !loading && filteredClassrooms.length !== classroomRows.length;

  const statusOptions = [
    { value: "ALL", label: "All", count: loading ? undefined : statistics.total },
    { value: "ACTIVE", label: "Active", count: loading ? undefined : statistics.active },
    { value: "INACTIVE", label: "Inactive", count: loading ? undefined : statistics.inactive },
  ];

  const healthOptions = [
    { value: "ALL", label: "All health" },
    { value: "NORMAL", label: "Normal", count: loading ? undefined : statistics.normal },
    { value: "WARNING", label: "Warning", count: loading ? undefined : statistics.warning },
    { value: "CRITICAL", label: "Critical", count: loading ? undefined : statistics.critical },
    { value: "NO_DATA", label: "No data", count: loading ? undefined : statistics.noHealthData },
  ];

  const openClassroom = (roomId) => navigateTo(`/supervisor/classrooms/${roomId}`);

  return (
    <AppShell
      eyebrow="Overview"
      title="Classrooms"
      actions={<RefreshButton onClick={loadClassroomData} loading={loading} />}
    >
      {error && (
        <Alert tone="danger" title="Unable to load classroom data" onRetry={loadClassroomData} className="mb-6">
          {error}
        </Alert>
      )}

      {/* KPIs */}
      <section aria-label="Classroom summary" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Classrooms"
          value={statistics.total}
          hint="Configured classrooms"
          icon="classroom"
          tone="brand"
          loading={loading}
        />
        <StatCard
          label="Active"
          value={statistics.active}
          hint={`${statistics.inactive} inactive`}
          icon="power"
          tone="info"
          loading={loading}
        />
        <StatCard
          label="Normal health"
          value={statistics.normal}
          hint={`${statistics.warning} warning · ${statistics.critical} critical · ${statistics.noHealthData} no data`}
          icon="heart"
          tone={statistics.critical > 0 ? "danger" : statistics.warning > 0 ? "warning" : "success"}
          loading={loading}
        />
        <StatCard
          label="Active faults"
          value={faults.length}
          hint={faults.length > 0 ? "Confirmed active faults" : "No confirmed faults"}
          icon="alert"
          tone={faults.length > 0 ? "danger" : "success"}
          loading={loading}
        />
      </section>

      {/* CLASSROOM TABLE */}
      <Card
        className="mt-6"
        title="Classroom status"
        subtitle={
          loading
            ? "Loading classrooms…"
            : `${filteredClassrooms.length} classroom${filteredClassrooms.length === 1 ? "" : "s"} shown`
        }
        icon="classroom"
        bodyClassName=""
        actions={filtersApplied ? <StatusBadge tone="brand" label="Filters applied" dot={false} /> : null}
      >
        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 xl:flex-row xl:items-center">
          <SearchInput
            id="classroom-search"
            label="Search classrooms"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by classroom, building, room type or ID…"
            className="xl:max-w-sm xl:flex-1"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:ml-auto">
            <Segmented
              ariaLabel="Filter by classroom status"
              options={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <Segmented
              ariaLabel="Filter by health status"
              options={healthOptions}
              value={healthFilter}
              onChange={setHealthFilter}
            />
          </div>
        </div>

        {loading ? (
          <SkeletonRows rows={6} />
        ) : filteredClassrooms.length === 0 ? (
          <EmptyState
            icon="search"
            title="No classrooms found"
            description="No classroom matches the current search and filter settings."
          />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[1000px]">
              <thead>
                <tr>
                  <th scope="col">Classroom</th>
                  <th scope="col">Location</th>
                  <th scope="col" className="text-right">Capacity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Health</th>
                  <th scope="col">Environment</th>
                  <th scope="col" className="text-right">Occupancy</th>
                  <th scope="col" className="text-right">Faults</th>
                  <th scope="col" className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredClassrooms.map((classroom) => {
                  const health = classroom.health;
                  const healthStatus = health?.health_status;

                  return (
                    <tr key={classroom.room_id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => openClassroom(classroom.room_id)}
                          className="group text-left"
                        >
                          <span className="block font-semibold text-slate-900 transition-colors group-hover:text-brand-700">
                            {classroom.room_name || `Room ${classroom.room_id}`}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-500">
                            <span className="num">ID {classroom.room_id}</span>
                            {classroom.room_type ? ` · ${classroom.room_type}` : ""}
                          </span>
                        </button>
                      </td>

                      <td>
                        <p className="text-sm font-medium text-slate-700">{classroom.building || "—"}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {classroom.floor !== null && classroom.floor !== undefined
                            ? `Floor ${classroom.floor}`
                            : "Floor —"}
                        </p>
                      </td>

                      <td className="text-right">
                        <span className="num font-medium text-slate-700">{getDisplayValue(classroom.capacity)}</span>
                      </td>

                      <td>
                        <StatusBadge status={classroom.status || "UNKNOWN"} />
                      </td>

                      <td>
                        {health ? (
                          <div>
                            <StatusBadge status={healthStatus || "UNKNOWN"} />
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="num w-7 text-xs font-semibold text-slate-700">
                                {getDisplayValue(health.health_score)}
                              </span>
                              {health.health_score != null && <ScoreBar value={health.health_score} className="w-16" />}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <StatusBadge tone="neutral" label="No health data" />
                            <p className="mt-1.5 text-[11px] text-slate-500">Not calculated yet</p>
                          </div>
                        )}
                      </td>

                      <td>
                        {health ? (
                          <ul className="num space-y-0.5 text-xs text-slate-700">
                            <li className="flex items-center gap-1.5">
                              <Icon name="thermometer" className="h-3.5 w-3.5 text-slate-400" />
                              <span className="sr-only">Temperature</span>
                              {getDisplayValue(health.temperature, "°C")}
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Icon name="gauge" className="h-3.5 w-3.5 text-slate-400" />
                              <span className="sr-only">Humidity</span>
                              {getDisplayValue(health.humidity, "%")}
                              <span className="text-slate-500">RH</span>
                            </li>
                            <li className="flex items-center gap-1.5">
                              <Icon name="zap" className="h-3.5 w-3.5 text-slate-400" />
                              <span className="sr-only">Power</span>
                              {getDisplayValue(health.power, " W")}
                            </li>
                          </ul>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="text-right">
                        {health ? (
                          <p>
                            <span className="num text-sm font-semibold text-slate-900">
                              {getDisplayValue(health.occupancy_count)}
                            </span>
                            <span className="ml-1 text-[11px] text-slate-500">people</span>
                          </p>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      <td className="text-right">
                        <span
                          className={`num inline-flex min-w-7 items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                            classroom.activeFaultCount > 0
                              ? "bg-red-50 text-red-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {classroom.activeFaultCount}
                        </span>
                      </td>

                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => openClassroom(classroom.room_id)}
                          className="btn btn-sm btn-secondary"
                        >
                          View details
                          <Icon name="arrowRight" className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
