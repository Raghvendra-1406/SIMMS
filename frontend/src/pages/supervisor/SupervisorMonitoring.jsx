import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "../../components/AppShell";
import Icon from "../../components/Icon";
import {
  Alert,
  Card,
  EmptyState,
  RefreshButton,
  ScoreBar,
  Segmented,
  SkeletonRows,
  StatusBadge,
} from "../../components/ui";
import { apiFetch } from "../../lib/api";
import { usePolling } from "../../lib/usePolling";

// Live monitor: the latest state of every classroom, refreshed every
// few seconds from GET /live/rooms, with demo-panel relay controls.

const POLL_INTERVAL_MS = 3000;

// A reading older than this is shown as stale.
const STALE_AFTER_SECONDS = 60;

// How long a relay button waits for the node to confirm the change.
const COMMAND_TIMEOUT_MS = 10000;

const FAULT_LABELS = {
  FAN_FAILURE: "Fan failure",
  LIGHTS_LEFT_ON: "Lights left on",
  ELECTRICAL_ABNORMALITY: "Electrical abnormality",
  BOARD_NEEDS_CLEANING: "Board needs cleaning",
};

const BOARD_TONES = {
  CLEAN: "success",
  IN_USE: "info",
  DIRTY: "warning",
  OCCLUDED: "neutral",
};

function faultLabel(type) {
  return FAULT_LABELS[type] || String(type || "Unknown").replaceAll("_", " ");
}

// True once the node reports the relay in the requested state.
function relayConfirmed(rooms, roomId, target, state) {
  const room = rooms.find((item) => item.room_id === roomId);
  const relays = room?.nodes.find((node) => node.kind === "SENSOR_NODE")?.details?.relays;
  const actual = target === "LAMP" ? relays?.lamp : relays?.fan;
  return actual === (state === "ON");
}

function formatNumber(value, digits = 1) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (Number.isNaN(number)) return String(value);
  return number.toFixed(digits);
}

function formatAge(seconds) {
  if (seconds === null || seconds === undefined) return "never";
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${Math.round(seconds)} s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return `${Math.round(seconds / 86400)} d ago`;
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Metric({ label, value, unit, emphasis = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-medium text-slate-500">{label}</dt>
      <dd className={`num mt-0.5 truncate font-semibold text-slate-900 ${emphasis ? "text-xl" : "text-sm"}`}>
        {value}
        {value !== "—" && unit && <span className="ml-0.5 text-xs font-medium text-slate-500">{unit}</span>}
      </dd>
    </div>
  );
}

function Freshness({ age }) {
  if (age === null || age === undefined) {
    return <span className="text-[11px] text-slate-400">No data yet</span>;
  }

  const stale = age > STALE_AFTER_SECONDS;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${stale ? "font-semibold text-amber-700" : "text-slate-400"}`}>
      <Icon name="clock" className="h-3 w-3" />
      {stale ? `Stale · ${formatAge(age)}` : formatAge(age)}
    </span>
  );
}

function Panel({ icon, title, age, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
          <Icon name={icon} className="h-4 w-4 text-slate-500" />
          {title}
        </p>
        {age !== false && <Freshness age={age} />}
      </div>
      {children}
    </section>
  );
}

function RelayButton({ label, icon, on, pending, disabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || pending || on === null}
      className={`btn btn-sm ${on ? "btn-secondary" : "btn-primary"}`}
      title={on === null ? "Relay state unknown until the node reports" : undefined}
    >
      {pending ? (
        <Icon name="loader" className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon name={icon} className="h-3.5 w-3.5" />
      )}
      {pending ? "Switching…" : on ? `Turn ${label} off` : `Turn ${label} on`}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Room card
// ---------------------------------------------------------------------------

function RoomCard({ room, ageOf, canControl, pendingCommands, onCommand }) {
  const electrical = room.sensors?.ELECTRICAL;
  const environment = room.sensors?.ENVIRONMENT;
  const light = room.sensors?.LIGHT;
  const occupancy = room.vision?.OCCUPANCY;
  const board = room.vision?.BOARD;

  const sensorNode = room.nodes.find((node) => node.kind === "SENSOR_NODE") || null;
  const relays = sensorNode?.details?.relays || null;
  const nodeOnline = sensorNode?.state === "ONLINE";

  const e = electrical?.data || {};
  const env = environment?.data || {};
  const occ = occupancy?.data || {};
  const boardData = board?.data?.board || {};

  const lightState = light?.data?.light_state;
  const health = room.health;
  const seatStates = occ.seat_states ? Object.entries(occ.seat_states) : [];

  const isPending = (target) => {
    const pending = pendingCommands[`${room.room_id}:${target}`];
    return Boolean(pending) && !relayConfirmed([room], room.room_id, target, pending.state);
  };

  const lampPending = isPending("LAMP");
  const fanPending = isPending("FAN");

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {room.room_name}
          {room.status !== "ACTIVE" && <StatusBadge status={room.status} size="sm" />}
        </span>
      }
      subtitle={[room.building, room.floor !== null && room.floor !== undefined ? `Floor ${room.floor}` : null, room.capacity ? `${room.capacity} seats` : null]
        .filter(Boolean)
        .join(" · ") || "Classroom"}
      icon="classroom"
      actions={
        <div className="flex items-center gap-2">
          {room.active_faults.length > 0 && (
            <StatusBadge tone="danger" label={`${room.active_faults.length} active fault${room.active_faults.length === 1 ? "" : "s"}`} />
          )}
          {health && <StatusBadge status={health.health_status} label={`${formatLabel(health.health_status)} · ${formatNumber(health.health_score, 0)}`} />}
        </div>
      }
      bodyClassName="card-body space-y-4"
    >
      {/* Nodes */}
      <div className="flex flex-wrap gap-2">
        {room.nodes.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
            <Icon name="wifiOff" className="h-4 w-4" />
            No node has reported yet. Start the ESP32 simulation or the fake node.
          </p>
        ) : (
          room.nodes.map((node) => (
            <div key={node.node_id} className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
              <Icon name={node.kind === "CAMERA" ? "camera" : "cpu"} className="h-4 w-4 text-slate-500" />
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-800">
                  {node.node_id}
                  <StatusBadge status={node.state} size="sm" />
                </p>
                <p className="num text-[11px] text-slate-500">
                  {node.state === "ONLINE" ? "seen" : "last seen"} {formatAge(ageOf(node.last_seen))}
                  {node.rssi !== null && node.rssi !== undefined && ` · ${node.rssi} dBm`}
                  {node.fw_version && ` · fw ${node.fw_version}`}
                  {node.details?.virtual && " · virtual"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Readings */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Panel icon="zap" title="Electrical" age={ageOf(electrical?.observed_at)}>
          <dl className="grid grid-cols-3 gap-3">
            <Metric label="Voltage" value={formatNumber(e.voltage)} unit="V" emphasis />
            <Metric label="Current" value={formatNumber(e.current, 2)} unit="A" emphasis />
            <Metric label="Power" value={formatNumber(e.power, 0)} unit="W" emphasis />
            <Metric label="Fan branch" value={formatNumber(e.fan_current, 2)} unit="A" />
            <Metric label="Power factor" value={formatNumber(e.power_factor, 2)} />
            <Metric label="Energy" value={formatNumber(e.energy, 3)} unit="kWh" />
          </dl>
        </Panel>

        <Panel icon="thermometer" title="Environment" age={ageOf(environment?.observed_at)}>
          <dl className="grid grid-cols-3 gap-3">
            <Metric label="Temperature" value={formatNumber(env.temperature)} unit="°C" emphasis />
            <Metric label="Humidity" value={formatNumber(env.humidity, 0)} unit="%" emphasis />
            <Metric label="Light level" value={formatNumber(env.light_level, 0)} unit="%" emphasis />
          </dl>
        </Panel>

        <Panel icon="users" title="Occupancy" age={ageOf(occupancy?.observed_at)}>
          <dl className="grid grid-cols-2 gap-3">
            <Metric label="People" value={occ.occupancy_count ?? "—"} emphasis />
            <Metric
              label="Seats occupied"
              value={occ.total_seats ? `${occ.occupied_seats}/${occ.total_seats}` : "—"}
              emphasis
            />
          </dl>
          {seatStates.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1" aria-label="Seat map">
              {seatStates.map(([seatId, taken]) => (
                <span
                  key={seatId}
                  title={`${seatId}: ${taken ? "occupied" : "empty"}`}
                  className={`h-3 w-3 rounded-sm ${taken ? "bg-brand-500" : "bg-slate-200"}`}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel icon="clipboard" title="Board" age={ageOf(board?.observed_at)}>
          <div className="flex items-center justify-between gap-2">
            {boardData.state ? (
              <StatusBadge tone={BOARD_TONES[boardData.state] || "neutral"} label={formatLabel(boardData.state)} />
            ) : (
              <span className="text-sm text-slate-400">—</span>
            )}
            <span className="num text-xl font-semibold text-slate-900">
              {boardData.ink_ratio !== null && boardData.ink_ratio !== undefined ? `${Math.round(boardData.ink_ratio * 100)}%` : "—"}
            </span>
          </div>
          <ScoreBar
            className="mt-3"
            value={(boardData.ink_ratio || 0) * 100 / 0.6}
            tone={boardData.state === "DIRTY" ? "warning" : "info"}
          />
          <p className="mt-2 text-[11px] text-slate-500">
            {boardData.state === "OCCLUDED"
              ? "Someone is standing at the board; reading skipped."
              : "Ink coverage. Above 25% with the room empty needs cleaning."}
          </p>
        </Panel>
      </div>

      {/* Loads and controls */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel icon="lightbulb" title="Lights" age={ageOf(light?.observed_at)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${lightState === "ON" ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-400"}`}>
                <Icon name="lightbulb" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {lightState === "ON" ? "On" : lightState === "OFF" ? "Off" : "Unknown"}
                </p>
                <p className="text-[11.5px] text-slate-500">
                  Relay: {relays ? (relays.lamp ? "on" : "off") : "unknown"}
                </p>
              </div>
            </div>
            {canControl && (
              <RelayButton
                label="lamp"
                icon="power"
                on={relays ? relays.lamp : null}
                pending={lampPending}
                disabled={!nodeOnline}
                onToggle={() => onCommand(room, "LAMP", relays?.lamp ? "OFF" : "ON")}
              />
            )}
          </div>
        </Panel>

        <Panel icon="fan" title="Fans" age={false}>
          <div className="space-y-3">
            {room.fans.length === 0 ? (
              <p className="text-xs text-slate-500">No fan devices registered for this room.</p>
            ) : (
              room.fans.map((fan) => {
                const motion = fan.data?.fan_motion;
                const running = motion?.running;
                return (
                  <div key={fan.device_id} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${running ? "bg-sky-100 text-sky-600" : "bg-slate-100 text-slate-400"}`}>
                        <Icon name="fan" className={`h-5 w-5 ${running ? "animate-spin [animation-duration:1.5s]" : ""}`} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {fan.device_name} · {motion ? (running ? "Rotating" : "Not rotating") : "No camera data"}
                        </p>
                        <p className="text-[11.5px] text-slate-500">
                          Relay: {relays ? (relays.fan ? "on" : "off") : "unknown"} · camera {formatAge(ageOf(fan.observed_at))}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {canControl && (
              <RelayButton
                label="fan"
                icon="power"
                on={relays ? relays.fan : null}
                pending={fanPending}
                disabled={!nodeOnline}
                onToggle={() => onCommand(room, "FAN", relays?.fan ? "OFF" : "ON")}
              />
            )}
          </div>
        </Panel>
      </div>

      {/* Faults */}
      {room.active_faults.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
          <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-red-800">
            <Icon name="alert" className="h-4 w-4" />
            Active faults
          </p>
          <ul className="space-y-1.5">
            {room.active_faults.map((fault) => (
              <li key={fault.fault_id} className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-red-900">
                <span className="font-medium">
                  {faultLabel(fault.fault_type)}
                  <span className="num ml-2 text-xs font-normal text-red-700">#{fault.fault_id}</span>
                </span>
                <span className="text-xs text-red-700">detected {formatAge(ageOf(fault.detected_at))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function formatLabel(value) {
  if (!value) return "—";
  const text = String(value).replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SupervisorMonitoring() {
  const role = localStorage.getItem("role");
  const canControl = role === "ADMIN" || role === "SUPERVISOR";

  const [rooms, setRooms] = useState([]);
  const [mqttConnected, setMqttConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState("ALL");
  const [pendingCommands, setPendingCommands] = useState({});

  // Latest rooms for the command timeout check.
  const roomsRef = useRef([]);

  // Clock offset: ages are measured on the server clock, so a wrong
  // PC clock does not make fresh readings look stale.
  const [clock, setClock] = useState({ serverMs: null, fetchedAt: null });
  const [now, setNow] = useState(() => Date.now());

  const loadLive = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setRefreshing(true);

    try {
      const data = await apiFetch("/live/rooms");

      setRooms(data.rooms || []);
      roomsRef.current = data.rooms || [];
      setMqttConnected(Boolean(data.mqtt_connected));
      setError("");

      const serverTime = data.rooms?.[0]?.server_time;
      if (serverTime) {
        setClock({ serverMs: new Date(serverTime).getTime(), fetchedAt: Date.now() });
      }
    } catch (err) {
      setError(err.message || "Unable to load live data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // The page starts in its loading state, so the first load is silent.
  usePolling(loadLive, POLL_INTERVAL_MS, { immediate: true });

  // Re-render ages every second between polls.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const ageOf = useCallback(
    (timestamp) => {
      if (!timestamp) return null;
      const reference =
        clock.serverMs !== null ? clock.serverMs + (now - clock.fetchedAt) : now;
      return Math.max(0, (reference - new Date(timestamp).getTime()) / 1000);
    },
    [clock, now]
  );

  const sendCommand = async (room, target, state) => {
    const key = `${room.room_id}:${target}`;

    setPendingCommands((previous) => ({ ...previous, [key]: { state } }));
    setNotice(null);

    try {
      await apiFetch(`/classrooms/${room.room_id}/commands`, {
        method: "POST",
        body: { target, state },
      });

      loadLive({ silent: true });

      setTimeout(() => {
        if (!relayConfirmed(roomsRef.current, room.room_id, target, state)) {
          setNotice({ tone: "warning", text: `${room.room_name}: the node did not confirm the ${target.toLowerCase()} change. Is it online?` });
        }
        setPendingCommands((previous) => ({ ...previous, [key]: null }));
      }, COMMAND_TIMEOUT_MS);
    } catch (err) {
      setPendingCommands((previous) => ({ ...previous, [key]: null }));
      setNotice({ tone: "danger", text: err.message || "Command failed." });
    }
  };

  const visibleRooms = useMemo(
    () =>
      selectedRoomId === "ALL"
        ? rooms
        : rooms.filter((room) => String(room.room_id) === selectedRoomId),
    [rooms, selectedRoomId]
  );

  const onlineNodes = rooms.reduce(
    (count, room) => count + room.nodes.filter((node) => node.state === "ONLINE").length,
    0
  );

  const roomOptions = [
    { value: "ALL", label: "All rooms", count: rooms.length },
    ...rooms.map((room) => ({ value: String(room.room_id), label: room.room_name })),
  ];

  return (
    <AppShell
      eyebrow="Operations"
      title="Live monitor"
      wide
      actions={
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[11.5px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/15 sm:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live · {POLL_INTERVAL_MS / 1000}s
          </span>
          <RefreshButton onClick={() => loadLive()} loading={refreshing} />
        </div>
      }
    >
      {error && (
        <Alert tone="danger" title="Unable to load live data" onRetry={() => loadLive()} className="mb-4">
          {error}
        </Alert>
      )}

      {!mqttConnected && !error && (
        <Alert tone="warning" title="Backend is not connected to the MQTT broker" className="mb-4">
          Readings will not update until the broker is reachable. Start Mosquitto; the backend reconnects on its own.
        </Alert>
      )}

      {notice && (
        <Alert tone={notice.tone} onDismiss={() => setNotice(null)} className="mb-4">
          {notice.text}
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {rooms.length > 1 ? (
          <Segmented options={roomOptions} value={selectedRoomId} onChange={setSelectedRoomId} ariaLabel="Room" />
        ) : (
          <span />
        )}
        <p className="text-xs text-slate-500">
          {rooms.length} room{rooms.length === 1 ? "" : "s"} · {onlineNodes} node{onlineNodes === 1 ? "" : "s"} online
        </p>
      </div>

      {loading ? (
        <Card>
          <SkeletonRows rows={4} />
        </Card>
      ) : visibleRooms.length === 0 ? (
        <Card>
          <EmptyState
            icon="classroom"
            title="No classrooms yet"
            description="Create a classroom (or run backend/scripts/seed_demo.py) and start the simulation."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {visibleRooms.map((room) => (
            <RoomCard
              key={room.room_id}
              room={room}
              ageOf={ageOf}
              canControl={canControl}
              pendingCommands={pendingCommands}
              onCommand={sendCommand}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
