import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  EmptyState,
  IconTile,
  RefreshButton,
  SearchInput,
  Segmented,
  SkeletonRows,
  StatCard,
} from "../../components/ui";
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

function getConfidenceLabel(confidence) {
  if (
    confidence === null ||
    confidence === undefined
  ) {
    return "—";
  }

  const value = Number(confidence);

  if (Number.isNaN(value)) {
    return confidence;
  }

  return `${(value).toFixed(1)}%`;
}

export default function SupervisorFaults() {
  const [faults, setFaults] =
    useState([]);

  const [classrooms, setClassrooms] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [faultTypeFilter, setFaultTypeFilter] =
    useState("ALL");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadFaults();
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
        // Keep default error message.
      }

      throw new Error(message);
    }

    return response.json();
  }

  async function loadFaults() {
    setLoading(true);
    setError("");

    try {
      const [
        faultsResult,
        classroomsResult,
      ] = await Promise.all([
        fetchApi("/faults/active"),
        fetchApi("/classrooms"),
      ]);

      setFaults(
        Array.isArray(faultsResult)
          ? faultsResult
          : []
      );

      setClassrooms(
        Array.isArray(classroomsResult)
          ? classroomsResult
          : []
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load active faults."
      );
    } finally {
      setLoading(false);
    }
  }

  function getClassroomName(roomId) {
    const classroom =
      classrooms.find(
        (room) =>
          Number(room.room_id) ===
          Number(roomId)
      );

    return (
      classroom?.room_name ||
      `Room ${roomId}`
    );
  }

  const filteredFaults = useMemo(() => {
    const searchValue =
      search.trim().toLowerCase();

    return faults.filter((fault) => {
      const matchesType =
        faultTypeFilter === "ALL" ||
        String(
          fault.fault_type || ""
        ).toUpperCase() ===
          faultTypeFilter;

      if (!matchesType) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      const classroomName =
        getClassroomName(
          fault.room_id
        );

      const searchableText = [
        fault.fault_id,
        fault.room_id,
        classroomName,
        fault.device_id,
        fault.fault_type,
        getFaultTypeLabel(
          fault.fault_type
        ),
        fault.status,
      ]
        .filter(
          (value) =>
            value !== null &&
            value !== undefined
        )
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        searchValue
      );
    });
  }, [
    faults,
    classrooms,
    search,
    faultTypeFilter,
  ]);

  const fanFailures = useMemo(
    () =>
      faults.filter(
        (fault) =>
          String(
            fault.fault_type || ""
          ).toUpperCase() ===
          "FAN_FAILURE"
      ).length,
    [faults]
  );

  const lightsLeftOn = useMemo(
    () =>
      faults.filter(
        (fault) =>
          String(
            fault.fault_type || ""
          ).toUpperCase() ===
          "LIGHTS_LEFT_ON"
      ).length,
    [faults]
  );

  const electricalFaults = useMemo(
    () =>
      faults.filter(
        (fault) =>
          String(
            fault.fault_type || ""
          ).toUpperCase() ===
          "ELECTRICAL_ABNORMALITY"
      ).length,
    [faults]
  );

  const typeOptions = [
    { value: "ALL", label: "All types", count: loading ? undefined : faults.length },
    { value: "FAN_FAILURE", label: "Fan failure", count: loading ? undefined : fanFailures },
    { value: "LIGHTS_LEFT_ON", label: "Lights left on", count: loading ? undefined : lightsLeftOn },
    { value: "ELECTRICAL_ABNORMALITY", label: "Electrical", count: loading ? undefined : electricalFaults },
  ];

  const openFault = (faultId) =>
    navigateTo(`/supervisor/faults/${faultId}`);

  return (
    <AppShell
      eyebrow="Operations"
      title="Faults"
      actions={<RefreshButton onClick={loadFaults} loading={loading} />}
    >
      {error && (
        <Alert tone="danger" title="Unable to load faults" onRetry={loadFaults} className="mb-6">
          {error}
        </Alert>
      )}

      {/* KPIs */}
      <section aria-label="Fault summary" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Active faults"
          value={faults.length}
          hint="All confirmed active faults"
          icon="alert"
          tone={faults.length > 0 ? "danger" : "success"}
          loading={loading}
          onClick={() => setFaultTypeFilter("ALL")}
        />
        <StatCard
          label="Fan failures"
          value={fanFailures}
          hint="Confirmed fan failures"
          icon="fan"
          tone={fanFailures > 0 ? "warning" : "neutral"}
          loading={loading}
          onClick={() => setFaultTypeFilter("FAN_FAILURE")}
        />
        <StatCard
          label="Lights left on"
          value={lightsLeftOn}
          hint="Confirmed lighting wastage"
          icon="lightbulb"
          tone={lightsLeftOn > 0 ? "warning" : "neutral"}
          loading={loading}
          onClick={() => setFaultTypeFilter("LIGHTS_LEFT_ON")}
        />
        <StatCard
          label="Electrical"
          value={electricalFaults}
          hint="Electrical abnormalities"
          icon="zap"
          tone={electricalFaults > 0 ? "danger" : "neutral"}
          loading={loading}
          onClick={() => setFaultTypeFilter("ELECTRICAL_ABNORMALITY")}
        />
      </section>

      {/* Fault records */}
      <Card
        className="mt-6"
        title="Active fault records"
        subtitle="Confirmed infrastructure faults requiring operational attention"
        icon="alert"
        bodyClassName=""
        actions={
          !loading && (
            <span className="num rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
              {filteredFaults.length} of {faults.length}
            </span>
          )
        }
      >
        {/* Filters */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput
            id="fault-search"
            label="Search faults"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search by classroom, fault type, device or ID…"
            className="w-full lg:max-w-sm"
          />
          <Segmented
            ariaLabel="Fault type"
            options={typeOptions}
            value={faultTypeFilter}
            onChange={setFaultTypeFilter}
          />
        </div>

        {loading ? (
          <SkeletonRows rows={5} />
        ) : filteredFaults.length === 0 ? (
          faults.length === 0 ? (
            <EmptyState
              icon="checkCircle"
              title="No active faults"
              description="There are currently no confirmed active faults."
            />
          ) : (
            <EmptyState
              icon="search"
              title="No matching faults"
              description="No faults match the current search or filter."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFaultTypeFilter("ALL");
                  }}
                  className="btn btn-sm btn-secondary"
                >
                  Clear filters
                </button>
              }
            />
          )
        ) : (
          <>
            {/* Desktop */}
            <div className="table-wrap hidden md:block">
              <table className="table min-w-[860px]">
                <thead>
                  <tr>
                    <th scope="col">Fault</th>
                    <th scope="col">Classroom</th>
                    <th scope="col">Device</th>
                    <th scope="col">Detected</th>
                    <th scope="col" className="text-right">Confidence</th>
                    <th scope="col" className="text-right">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFaults.map((fault) => {
                    const meta = getFaultTypeMeta(fault.fault_type);

                    return (
                      <tr key={fault.fault_id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <IconTile icon={meta.icon} tone={meta.tone} className="h-8 w-8" />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900">
                                {getFaultTypeLabel(fault.fault_type)}
                              </p>
                              <p className="num mt-0.5 text-[11px] text-slate-500">
                                Fault #{fault.fault_id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="font-medium text-slate-900">
                            {getClassroomName(fault.room_id)}
                          </p>
                          <p className="num mt-0.5 text-[11px] text-slate-500">
                            Room #{fault.room_id}
                          </p>
                        </td>
                        <td>
                          {fault.device_id ? (
                            <span className="num text-sm text-slate-700">
                              Device #{fault.device_id}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Room-level</span>
                          )}
                        </td>
                        <td>
                          <span className="num whitespace-nowrap text-xs text-slate-600">
                            {formatDateTime(fault.detected_at)}
                          </span>
                        </td>
                        <td className="text-right">
                          <p className="num font-semibold text-slate-900">
                            {getConfidenceLabel(fault.confidence)}
                          </p>
                          {fault.abnormal_count !== null &&
                            fault.abnormal_count !== undefined && (
                              <p className="num mt-0.5 text-[11px] text-slate-500">
                                Abnormal: {fault.abnormal_count}
                              </p>
                            )}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => openFault(fault.fault_id)}
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

            {/* Mobile */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {filteredFaults.map((fault) => {
                const meta = getFaultTypeMeta(fault.fault_type);

                return (
                  <li key={fault.fault_id}>
                    <button
                      type="button"
                      onClick={() => openFault(fault.fault_id)}
                      className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-slate-50"
                    >
                      <IconTile icon={meta.icon} tone={meta.tone} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {getFaultTypeLabel(fault.fault_type)}
                          </p>
                          <span className="num shrink-0 text-xs font-semibold text-slate-700">
                            {getConfidenceLabel(fault.confidence)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs font-medium text-slate-700">
                          {getClassroomName(fault.room_id)}
                        </p>
                        <p className="num mt-0.5 text-[11px] text-slate-500">
                          Fault #{fault.fault_id} ·{" "}
                          {fault.device_id
                            ? `Device #${fault.device_id}`
                            : "Room-level"}
                        </p>
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
                          <Icon name="clock" className="h-3 w-3" />
                          <span className="num">{formatDateTime(fault.detected_at)}</span>
                        </p>
                      </div>
                      <Icon name="chevronRight" className="mt-2 h-4 w-4 shrink-0 text-slate-400" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </AppShell>
  );
}
