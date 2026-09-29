import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  EmptyState,
  IconTile,
  Modal,
  RefreshButton,
  Segmented,
  SearchInput,
  SkeletonRows,
  Spinner,
  StatCard,
  StatusBadge,
} from "../../components/ui";

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

function formatDeviceType(value) {
  if (!value) return "—";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Hardware types offered in the add/edit form, with display label and icon.
const DEVICE_TYPE_OPTIONS = [
  { value: "ESP32", label: "ESP32", icon: "cpu" },
  { value: "RASPBERRY_PI", label: "Raspberry Pi", icon: "server" },
  { value: "PZEM", label: "PZEM", icon: "zap" },
  { value: "CT_SENSOR", label: "CT Sensor", icon: "gauge" },
  { value: "DHT11", label: "DHT11", icon: "thermometer" },
  { value: "LDR", label: "LDR", icon: "sun" },
  { value: "CAMERA", label: "Camera", icon: "camera" },
];

function deviceTypeMeta(type) {
  const match = DEVICE_TYPE_OPTIONS.find((option) => option.value === type);

  return {
    label: match?.label || formatDeviceType(type),
    icon: match?.icon || "device",
  };
}

export default function AdminDevices() {
  const [devices, setDevices] = useState([]);
  const [classrooms, setClassrooms] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [roomFilter, setRoomFilter] = useState("ALL");

  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  const [deviceForm, setDeviceForm] = useState({
    room_id: "",
    device_type: "",
    device_name: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const headers = getAuthHeaders();

      const [devicesResponse, classroomsResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/devices`, {
          headers,
        }),

        fetch(`${API_BASE_URL}/classrooms`, {
          headers,
        }),
      ]);

      if (!devicesResponse.ok || !classroomsResponse.ok) {
        throw new Error("Unable to load device data from the SIMMS backend.");
      }

      const [devicesData, classroomsData] = await Promise.all([
        devicesResponse.json(),
        classroomsResponse.json(),
      ]);

      setDevices(Array.isArray(devicesData) ? devicesData : []);

      setClassrooms(Array.isArray(classroomsData) ? classroomsData : []);
    } catch (err) {
      setError(err.message || "Unable to connect to the SIMMS backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getRoomName = (roomId) => {
    const room = classrooms.find((item) => item.room_id === roomId);

    return room?.room_name || `Room ${roomId}`;
  };

  const deviceTypes = useMemo(() => {
    return Array.from(
      new Set(devices.map((device) => device.device_type).filter(Boolean))
    ).sort();
  }, [devices]);

  const filteredDevices = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return devices.filter((device) => {
      const matchesSearch =
        !search ||
        String(device.device_id).toLowerCase().includes(search) ||
        String(device.device_name || "").toLowerCase().includes(search) ||
        String(device.device_type || "").toLowerCase().includes(search) ||
        String(getRoomName(device.room_id)).toLowerCase().includes(search);

      const matchesStatus =
        statusFilter === "ALL" || device.status === statusFilter;

      const matchesType =
        typeFilter === "ALL" || device.device_type === typeFilter;

      const matchesRoom =
        roomFilter === "ALL" || String(device.room_id) === String(roomFilter);

      return matchesSearch && matchesStatus && matchesType && matchesRoom;
    });
  }, [devices, searchTerm, statusFilter, typeFilter, roomFilter, classrooms]);

  const activeDevices = devices.filter(
    (device) => device.status === "ACTIVE"
  ).length;

  const inactiveDevices = devices.length - activeDevices;

  const openAddModal = () => {
    setEditingDevice(null);

    setDeviceForm({
      room_id: "",
      device_type: "",
      device_name: "",
    });

    setShowModal(true);
  };

  const openEditModal = (device) => {
    setEditingDevice(device);

    setDeviceForm({
      room_id: device.room_id ?? "",
      device_type: device.device_type || "",
      device_name: device.device_name || "",
    });

    setShowModal(true);
  };

  // The original close controls were disabled while saving.
  const closeModal = useCallback(() => {
    if (!saving) setShowModal(false);
  }, [saving]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setDeviceForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !deviceForm.room_id ||
      !deviceForm.device_type.trim() ||
      !deviceForm.device_name.trim()
    ) {
      setError("Classroom, device type, and device name are required.");

      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        room_id: Number(deviceForm.room_id),
        device_type: deviceForm.device_type.trim(),
        device_name: deviceForm.device_name.trim(),
      };

      const response = editingDevice
        ? await fetch(`${API_BASE_URL}/devices/${editingDevice.device_id}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          })
        : await fetch(`${API_BASE_URL}/devices`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
          });

      if (!response.ok) {
        let detail = "Unable to save device.";

        try {
          const data = await response.json();

          if (data?.detail) {
            detail =
              typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
          }
        } catch {
          // Keep default error.
        }

        throw new Error(detail);
      }

      setShowModal(false);

      await loadData();
    } catch (err) {
      setError(err.message || "Unable to save device.");
    } finally {
      setSaving(false);
    }
  };

  const toggleDeviceStatus = async (device) => {
    const nextStatus = device.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      setStatusUpdatingId(device.device_id);

      setError("");

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
        let detail = "Unable to update device status.";

        try {
          const data = await response.json();

          if (data?.detail) {
            detail =
              typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
          }
        } catch {
          // Keep default error.
        }

        throw new Error(detail);
      }

      await loadData();
    } catch (err) {
      setError(err.message || "Unable to update device status.");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setRoomFilter("ALL");
  };

  const hasFilters =
    searchTerm !== "" ||
    statusFilter !== "ALL" ||
    typeFilter !== "ALL" ||
    roomFilter !== "ALL";

  const statusOptions = [
    { value: "ALL", label: "All", count: devices.length },
    { value: "ACTIVE", label: "Active", count: activeDevices },
    { value: "INACTIVE", label: "Inactive", count: inactiveDevices },
  ];

  // Load failed and nothing to show: KPI cards display "—" instead of misleading zeros.

  const loadFailed = Boolean(error) && devices.length === 0;


  return (
    <AppShell
      eyebrow="Infrastructure"
      title="Devices"
      actions={
        <>
          <RefreshButton onClick={loadData} loading={loading} />
          <button type="button" onClick={openAddModal} className="btn btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            <span className="hidden sm:inline">Add device</span>
            <span className="sr-only sm:hidden">Add device</span>
          </button>
        </>
      }
    >
      {error && !showModal && (
        <Alert
          tone="danger"
          title="Device data could not be processed"
          onRetry={loadData}
          onDismiss={() => setError("")}
          className="mb-6"
        >
          {error}
        </Alert>
      )}

      {/* KPIs */}
      <section aria-label="Device metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          unavailable={loadFailed}
          label="Total devices"
          value={devices.length}
          hint="Registered devices"
          icon="device"
          tone="brand"
          loading={loading}
        />
        <StatCard
          unavailable={loadFailed}
          label="Active"
          value={activeDevices}
          hint="Currently reporting to SIMMS"
          icon="checkCircle"
          tone="success"
          loading={loading}
        />
        <StatCard
          unavailable={loadFailed}
          label="Inactive"
          value={inactiveDevices}
          hint="Deactivated or out of service"
          icon="power"
          tone="neutral"
          loading={loading}
        />
        <StatCard
          unavailable={loadFailed}
          label="Device types"
          value={deviceTypes.length}
          hint="Distinct hardware types"
          icon="layers"
          tone="info"
          loading={loading}
        />
      </section>

      {/* DIRECTORY */}
      <Card
        className="mt-6"
        title="Device directory"
        subtitle={
          loading
            ? "Loading devices…"
            : `Showing ${filteredDevices.length} of ${devices.length} devices`
        }
        icon="server"
        bodyClassName=""
      >
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3.5 lg:flex-row lg:items-center">
          <SearchInput
            id="device-search"
            label="Search devices"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search device, ID, type or classroom…"
            className="w-full lg:max-w-sm lg:flex-1"
          />

          <Segmented
            ariaLabel="Filter by status"
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            className="self-start lg:self-auto"
          />

          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center lg:ml-auto">
            <div>
              <label htmlFor="device-type-filter" className="sr-only">
                Device type
              </label>
              <select
                id="device-type-filter"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="select sm:w-44"
              >
                <option value="ALL">All types</option>
                {deviceTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatDeviceType(type)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="device-room-filter" className="sr-only">
                Classroom
              </label>
              <select
                id="device-room-filter"
                value={roomFilter}
                onChange={(event) => setRoomFilter(event.target.value)}
                className="select sm:w-48"
              >
                <option value="ALL">All classrooms</option>
                {classrooms.map((room) => (
                  <option key={room.room_id} value={room.room_id}>
                    {room.room_name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="btn btn-ghost col-span-2 sm:col-span-1"
            >
              <Icon name="x" className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>

        {loading ? (
          <SkeletonRows rows={6} />
        ) : filteredDevices.length === 0 ? (
          devices.length === 0 ? (
            <EmptyState
              icon="device"
              title="No devices registered"
              description="Register the first piece of classroom hardware to start monitoring it."
              action={
                <button type="button" onClick={openAddModal} className="btn btn-primary">
                  <Icon name="plus" className="h-4 w-4" />
                  Add device
                </button>
              }
            />
          ) : (
            <EmptyState
              icon="search"
              title="No devices found"
              description="No devices match the current search or filters."
              action={
                <button type="button" onClick={clearFilters} className="btn btn-secondary">
                  Clear filters
                </button>
              }
            />
          )
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[880px]">
              <thead>
                <tr>
                  <th scope="col">Device</th>
                  <th scope="col">Type</th>
                  <th scope="col">Classroom</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last seen</th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredDevices.map((device) => {
                  const typeMeta = deviceTypeMeta(device.device_type);
                  const isActive = device.status === "ACTIVE";
                  const isUpdating = statusUpdatingId === device.device_id;
                  const deviceLabel =
                    device.device_name || `Device ${device.device_id}`;

                  return (
                    <tr key={device.device_id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <IconTile
                            icon={typeMeta.icon}
                            tone={isActive ? "brand" : "neutral"}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {deviceLabel}
                            </p>
                            <p className="num mt-0.5 text-[11px] text-slate-500">
                              ID {device.device_id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="inline-flex h-6 items-center rounded-md bg-slate-100 px-2 text-xs font-medium text-slate-600">
                          {typeMeta.label}
                        </span>
                      </td>

                      <td>
                        <p className="font-medium text-slate-800">
                          {getRoomName(device.room_id)}
                        </p>
                        <p className="num mt-0.5 text-[11px] text-slate-500">
                          Room {device.room_id}
                        </p>
                      </td>

                      <td>
                        <StatusBadge status={device.status} />
                      </td>

                      <td>
                        <span className="num text-xs text-slate-600">
                          {formatDate(device.last_seen)}
                        </span>
                      </td>

                      <td>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(device)}
                            className="btn btn-sm btn-secondary"
                            aria-label={`Edit ${deviceLabel}`}
                          >
                            <Icon name="edit" className="h-3.5 w-3.5" />
                            Edit
                          </button>

                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => toggleDeviceStatus(device)}
                            className={`btn btn-sm min-w-[112px] ${
                              isActive
                                ? "btn-danger-soft"
                                : "btn-secondary text-emerald-700 hover:text-emerald-800"
                            }`}
                            aria-label={`${isActive ? "Deactivate" : "Activate"} ${deviceLabel}`}
                          >
                            {isUpdating ? (
                              <>
                                <Spinner className="h-3.5 w-3.5" />
                                Updating…
                              </>
                            ) : isActive ? (
                              <>
                                <Icon name="power" className="h-3.5 w-3.5" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Icon name="checkCircle" className="h-3.5 w-3.5" />
                                Activate
                              </>
                            )}
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

      {/* ADD / EDIT MODAL */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingDevice ? "Edit device" : "Add device"}
        description={
          editingDevice
            ? `Update the configuration for ${
                editingDevice.device_name || `Device ${editingDevice.device_id}`
              }.`
            : "Register new hardware and assign it to a classroom."
        }
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              disabled={saving}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="device-form"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? (
                <>
                  <Spinner />
                  Saving…
                </>
              ) : editingDevice ? (
                <>
                  <Icon name="save" className="h-4 w-4" />
                  Save changes
                </>
              ) : (
                <>
                  <Icon name="plus" className="h-4 w-4" />
                  Add device
                </>
              )}
            </button>
          </>
        }
      >
        <form id="device-form" onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <Alert tone="danger" onDismiss={() => setError("")}>
              {error}
            </Alert>
          )}

          {editingDevice && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <span className="num text-xs text-slate-500">
                Device ID {editingDevice.device_id}
              </span>
              <StatusBadge status={editingDevice.status} size="sm" />
            </div>
          )}

          <div>
            <label htmlFor="device-room" className="label">
              Classroom <span className="text-red-500">*</span>
            </label>
            <select
              id="device-room"
              name="room_id"
              value={deviceForm.room_id}
              onChange={handleChange}
              aria-required="true"
              className="select"
            >
              <option value="">Select classroom</option>
              {classrooms.map((room) => (
                <option key={room.room_id} value={room.room_id}>
                  {room.room_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="device-type" className="label">
              Device type <span className="text-red-500">*</span>
            </label>
            <select
              id="device-type"
              name="device_type"
              value={deviceForm.device_type}
              onChange={handleChange}
              aria-required="true"
              className="select"
            >
              <option value="">Select device type</option>
              {DEVICE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="device-name" className="label">
              Device name <span className="text-red-500">*</span>
            </label>
            <input
              id="device-name"
              type="text"
              name="device_name"
              value={deviceForm.device_name}
              onChange={handleChange}
              placeholder="Example: Classroom ESP32"
              aria-required="true"
              aria-describedby="device-name-help"
              className="input"
            />
            <p id="device-name-help" className="help-text">
              A recognisable name shown on dashboards and fault reports.
            </p>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
