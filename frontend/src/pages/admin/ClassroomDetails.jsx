import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  DetailItem,
  EmptyState,
  IconTile,
  Modal,
  RefreshButton,
  ScoreBar,
  SkeletonRows,
  Spinner,
  StatusBadge,
} from "../../components/ui";
import { navigateTo } from "../../lib/session";
import { usePolling } from "../../lib/usePolling";

// Backend URL: VITE_API_BASE_URL at build time (see lib/api.js).
import { API_BASE_URL } from "../../lib/api";

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

// Display metadata for the device types offered in the device form.
const DEVICE_TYPES = {
  ESP32: { label: "ESP32", icon: "cpu" },
  RASPBERRY_PI: { label: "Raspberry Pi", icon: "server" },
  PZEM: { label: "PZEM", icon: "zap" },
  CT_SENSOR: { label: "CT Sensor", icon: "gauge" },
  DHT11: { label: "DHT11", icon: "thermometer" },
  LDR: { label: "LDR", icon: "sun" },
  CAMERA: { label: "Camera", icon: "camera" },
};

function deviceTypeMeta(type) {
  return DEVICE_TYPES[type] || { label: type ? String(type).replaceAll("_", " ") : "—", icon: "device" };
}

function isDeviceUp(status) {
  return status === "ACTIVE" || status === "ONLINE";
}

function DetailsSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading classroom…</span>
      <div className="card flex items-center gap-4 p-5">
        <span className="skeleton h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <span className="skeleton block h-5 w-48" />
          <span className="skeleton block h-3 w-32" />
        </div>
        <span className="skeleton hidden h-9 w-28 sm:block" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="card p-5">
          <span className="skeleton block h-4 w-40" />
          <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <span className="skeleton block h-3 w-16" />
                <span className="skeleton block h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <span className="skeleton block h-4 w-32" />
          <span className="skeleton mt-6 block h-10 w-full" />
          <span className="skeleton mt-4 block h-24 w-full" />
        </div>
      </div>
      <div className="card mt-6">
        <SkeletonRows rows={4} />
      </div>
    </div>
  );
}

export default function ClassroomDetails() {
  const [room, setRoom] = useState(null);
  const [devices, setDevices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [deviceLoading, setDeviceLoading] =
    useState(true);

  const [error, setError] = useState("");
  const [deviceError, setDeviceError] =
    useState("");

  const [showDeviceModal, setShowDeviceModal] =
    useState(false);

  const [editingDevice, setEditingDevice] =
    useState(null);

  const [savingDevice, setSavingDevice] =
    useState(false);

  const [actionError, setActionError] =
    useState("");

  const [deviceForm, setDeviceForm] = useState({
    device_type: "",
    device_name: "",
  });

  const pathParts =
    window.location.pathname.split("/");

  const roomId = pathParts[
    pathParts.length - 1
  ];

  const loadRoom = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/classrooms/${roomId}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load classroom information."
        );
      }

      const data = await response.json();

      setRoom(data);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load classroom."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async ({ silent = false } = {}) => {
    try {
      if (!silent) setDeviceLoading(true);
      setDeviceError("");

      const response = await fetch(
        `${API_BASE_URL}/devices/room/${roomId}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load classroom devices."
        );
      }

      const data = await response.json();

      setDevices(
        Array.isArray(data) ? data : []
      );
    } catch (err) {
      setDeviceError(
        err.message ||
          "Unable to load devices."
      );
    } finally {
      setDeviceLoading(false);
    }
  };

  const loadData = async ({ silent = false } = {}) => {
    await Promise.all([
      loadRoom({ silent }),
      loadDevices({ silent }),
    ]);
  };

  useEffect(() => {
    if (!roomId) {
      setError("Invalid classroom ID.");
      setLoading(false);
      return;
    }

    loadData();
  }, [roomId]);

  // Keep the page in sync with live data without flashing skeletons.
  usePolling(loadData, 10000);

  const openAddDeviceModal = () => {
    setEditingDevice(null);

    setDeviceForm({
      device_type: "",
      device_name: "",
    });

    setActionError("");
    setShowDeviceModal(true);
  };

  const openEditDeviceModal = (device) => {
    setEditingDevice(device);

    setDeviceForm({
      device_type: device.device_type || "",
      device_name: device.device_name || "",
    });

    setActionError("");
    setShowDeviceModal(true);
  };

  const handleDeviceFormChange = (event) => {
    const { name, value } = event.target;

    setDeviceForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSaveDevice = async (event) => {
    event.preventDefault();

    setSavingDevice(true);
    setActionError("");

    try {
      const payload = {
        room_id: Number(roomId),
        device_type:
          deviceForm.device_type.trim(),
        device_name:
          deviceForm.device_name.trim(),
      };

      let response;

      if (editingDevice) {
        response = await fetch(
          `${API_BASE_URL}/devices/${editingDevice.device_id}`,
          {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          }
        );
      } else {
        response = await fetch(
          `${API_BASE_URL}/devices`,
          {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          }
        );
      }

      if (!response.ok) {
        let detail =
          "Unable to save device.";

        try {
          const data = await response.json();

          if (data.detail) {
            detail = Array.isArray(data.detail)
              ? data.detail
                  .map((item) => item.msg)
                  .join(", ")
              : data.detail;
          }
        } catch {
          // Keep default.
        }

        throw new Error(detail);
      }

      setShowDeviceModal(false);

      await loadDevices();
    } catch (err) {
      setActionError(
        err.message ||
          "Unable to save device."
      );
    } finally {
      setSavingDevice(false);
    }
  };

  const handleDeviceStatus = async (device) => {
    const nextStatus =
      device.status === "ACTIVE"
        ? "INACTIVE"
        : "ACTIVE";

    const confirmed = window.confirm(
      `${nextStatus === "ACTIVE" ? "Activate" : "Deactivate"} "${device.device_name}"?`
    );

    if (!confirmed) return;

    try {
      setActionError("");

      const response = await fetch(
        `${API_BASE_URL}/devices/${device.device_id}/status`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      if (!response.ok) {
        let detail =
          "Unable to update device status.";

        try {
          const data = await response.json();

          if (data.detail) {
            detail =
              typeof data.detail === "string"
                ? data.detail
                : detail;
          }
        } catch {
          // Keep default.
        }

        throw new Error(detail);
      }

      await loadDevices();
    } catch (err) {
      setActionError(
        err.message ||
          "Unable to update device status."
      );
    }
  };

  const refreshAction = (
    <RefreshButton onClick={loadData} loading={loading || deviceLoading} />
  );

  if (loading) {
    return (
      <AppShell
        eyebrow="Classrooms"
        title="Classroom details"
        backHref="/admin/rooms"
        actions={refreshAction}
      >
        <DetailsSkeleton />
      </AppShell>
    );
  }

  if (error || !room) {
    return (
      <AppShell
        eyebrow="Classrooms"
        title="Classroom details"
        backHref="/admin/rooms"
      >
        <div className="card">
          <EmptyState
            icon="alertCircle"
            title="Classroom unavailable"
            description={error || "The requested classroom could not be loaded."}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {roomId && (
                  <button type="button" onClick={loadData} className="btn btn-secondary">
                    <Icon name="refresh" className="h-4 w-4" />
                    Retry
                  </button>
                )}
                <button type="button" onClick={() => navigateTo("/admin/rooms")} className="btn btn-primary">
                  <Icon name="arrowLeft" className="h-4 w-4" />
                  Back to classrooms
                </button>
              </div>
            }
          />
        </div>
      </AppShell>
    );
  }

  const upDevices = devices.filter((device) => isDeviceUp(device.status)).length;
  const downDevices = devices.length - upDevices;

  const typeCounts = devices.reduce((counts, device) => {
    const key = device.device_type || "UNKNOWN";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  const roomActive = room.status === "ACTIVE";

  return (
    <AppShell
      eyebrow="Classrooms"
      title={room.room_name || "Classroom details"}
      backHref="/admin/rooms"
      actions={refreshAction}
    >
      {/* SUMMARY HEADER */}
      <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <IconTile icon="classroom" tone={roomActive ? "brand" : "neutral"} className="h-12 w-12 rounded-xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold tracking-tight text-slate-900">{room.room_name}</h2>
              <StatusBadge status={room.status} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-slate-500">
              <span className="num">ID {room.room_id}</span>
              <span aria-hidden="true">·</span>
              <span>{room.room_type || "Classroom"}</span>
              {room.building && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="mapPin" className="h-3.5 w-3.5" />
                    {room.building}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <button type="button" onClick={openAddDeviceModal} className="btn btn-primary self-start sm:self-auto">
          <Icon name="plus" className="h-4 w-4" />
          Add device
        </button>
      </section>

      {/* INFO + DEVICE SUMMARY */}
      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Classroom information" subtitle="Registered details for this room" icon="info">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailItem label="Classroom name">{room.room_name || "—"}</DetailItem>
            <DetailItem label="Room ID" mono>{room.room_id}</DetailItem>
            <DetailItem label="Room type">{room.room_type || "—"}</DetailItem>
            <DetailItem label="Status">
              <StatusBadge status={room.status} size="sm" />
            </DetailItem>
            <DetailItem label="Building">{room.building || "—"}</DetailItem>
            <DetailItem label="Floor" mono>{room.floor ?? "—"}</DetailItem>
            <DetailItem label="Capacity" mono>
              {room.capacity != null ? (
                <>
                  {room.capacity} <span className="font-sans font-normal text-slate-500">seats</span>
                </>
              ) : (
                "—"
              )}
            </DetailItem>
            <DetailItem label="Devices" mono>{deviceLoading ? "…" : devices.length}</DetailItem>
          </dl>
        </Card>

        <Card title="Device summary" subtitle="Connected hardware in this room" icon="device">
          {deviceLoading ? (
            <div className="space-y-3" aria-busy="true">
              <span className="skeleton block h-10 w-full" />
              <span className="skeleton block h-20 w-full" />
            </div>
          ) : devices.length === 0 ? (
            <p className="text-sm text-slate-500">No devices registered for this classroom yet.</p>
          ) : (
            <>
              <div className="flex items-end justify-between gap-3">
                <p className="num text-sm text-slate-500">
                  <span className="text-[28px] font-semibold leading-tight text-slate-900">{upDevices}</span>
                  <span className="text-slate-400"> / {devices.length}</span>
                </p>
                <span className="text-xs font-medium text-slate-500">active</span>
              </div>
              <ScoreBar
                value={(upDevices / devices.length) * 100}
                tone={downDevices === 0 ? "success" : "warning"}
                className="mt-2.5"
              />
              <p className="mt-2 text-xs text-slate-500">
                {downDevices === 0
                  ? "All devices are active."
                  : `${downDevices} ${downDevices === 1 ? "device is" : "devices are"} inactive or offline.`}
              </p>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="eyebrow mb-3">By type</p>
                <ul className="space-y-2">
                  {Object.entries(typeCounts).map(([type, count]) => {
                    const meta = deviceTypeMeta(type);
                    return (
                      <li key={type} className="flex items-center gap-2.5 text-sm">
                        <Icon name={meta.icon} className="h-4 w-4 text-slate-400" />
                        <span className="flex-1 text-slate-700">{meta.label}</span>
                        <span className="num font-semibold text-slate-900">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </Card>
      </section>

      {/* DEVICES */}
      <Card
        className="mt-6"
        title="Devices in this classroom"
        subtitle={`Devices assigned specifically to ${room.room_name}.`}
        icon="layers"
        bodyClassName=""
        actions={
          devices.length > 0 && (
            <button type="button" onClick={openAddDeviceModal} className="btn btn-sm btn-secondary">
              <Icon name="plus" className="h-3.5 w-3.5" />
              Add device
            </button>
          )
        }
      >
        {(actionError && !showDeviceModal) || deviceError ? (
          <div className="space-y-3 border-b border-slate-100 px-5 py-4">
            {actionError && !showDeviceModal && (
              <Alert tone="danger" onDismiss={() => setActionError("")}>
                {actionError}
              </Alert>
            )}
            {deviceError && (
              <Alert tone="danger" onRetry={loadDevices}>
                {deviceError}
              </Alert>
            )}
          </div>
        ) : null}

        {deviceLoading ? (
          <SkeletonRows rows={4} />
        ) : devices.length === 0 ? (
          <EmptyState
            icon="device"
            title="No devices assigned"
            description="This classroom does not have any devices registered yet. Add the classroom's ESP32, sensors, camera, or other supported devices."
            action={
              <button type="button" onClick={openAddDeviceModal} className="btn btn-primary">
                <Icon name="plus" className="h-4 w-4" />
                Add first device
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th scope="col">Device</th>
                  <th scope="col">Type</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last seen</th>
                  <th scope="col" className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => {
                  const meta = deviceTypeMeta(device.device_type);
                  const active = device.status === "ACTIVE";

                  return (
                    <tr key={device.device_id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <IconTile icon={meta.icon} tone={isDeviceUp(device.status) ? "info" : "neutral"} className="h-9 w-9" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{device.device_name || "Unnamed device"}</p>
                            <p className="num mt-0.5 text-[11px] text-slate-500">ID {device.device_id}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex h-6 items-center rounded-md bg-slate-100 px-2 text-xs font-medium text-slate-600">
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={device.status} />
                      </td>
                      <td>
                        <span className="num inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <Icon name="clock" className="h-3.5 w-3.5 text-slate-400" />
                          {formatDate(device.last_seen)}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditDeviceModal(device)}
                            className="btn btn-sm btn-secondary"
                          >
                            <Icon name="edit" className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeviceStatus(device)}
                            className={`btn btn-sm border ${
                              active
                                ? "border-amber-200 bg-white text-amber-700 hover:bg-amber-50"
                                : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            <Icon name="power" className="h-3.5 w-3.5" />
                            {active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* DEVICE MODAL */}
      <Modal
        open={showDeviceModal}
        onClose={() => setShowDeviceModal(false)}
        title={editingDevice ? "Edit device" : "Add device"}
        description={`Device will be assigned to ${room.room_name}.`}
        footer={
          <>
            <button type="button" onClick={() => setShowDeviceModal(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" form="device-form" disabled={savingDevice} className="btn btn-primary">
              {savingDevice && <Spinner />}
              {savingDevice ? "Saving…" : editingDevice ? "Save changes" : "Add device"}
            </button>
          </>
        }
      >
        <form id="device-form" onSubmit={handleSaveDevice} className="space-y-5">
          {actionError && <Alert tone="danger">{actionError}</Alert>}

          <div className="flex items-center gap-3 rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-3">
            <IconTile icon="classroom" tone="brand" className="h-9 w-9" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-brand-700">Assigned classroom</p>
              <p className="truncate text-sm font-semibold text-slate-900">{room.room_name}</p>
              <p className="num text-[11px] text-slate-500">Room ID {room.room_id}</p>
            </div>
          </div>

          <div>
            <label htmlFor="device_name" className="label">
              Device name <span className="text-red-500">*</span>
            </label>
            <input
              id="device_name"
              name="device_name"
              value={deviceForm.device_name}
              onChange={handleDeviceFormChange}
              required
              placeholder="e.g. Classroom ESP32"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="device_type" className="label">
              Device type <span className="text-red-500">*</span>
            </label>
            <select
              id="device_type"
              name="device_type"
              value={deviceForm.device_type}
              onChange={handleDeviceFormChange}
              required
              className="select"
            >
              <option value="">Select device type</option>
              <option value="ESP32">ESP32</option>
              <option value="RASPBERRY_PI">Raspberry Pi</option>
              <option value="PZEM">PZEM</option>
              <option value="CT_SENSOR">CT Sensor</option>
              <option value="DHT11">DHT11</option>
              <option value="LDR">LDR</option>
              <option value="CAMERA">Camera</option>
            </select>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-xs font-semibold text-slate-700">Device status</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                New devices are created through the backend device endpoint. Their status is managed using the
                existing SIMMS device status API.
              </p>
            </div>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
