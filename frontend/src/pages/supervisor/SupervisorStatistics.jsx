import { useCallback, useEffect, useMemo, useState } from "react";
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
  StatCard,
  StatusBadge,
} from "../../components/ui";
import { apiFetch } from "../../lib/api";
import { navigateTo } from "../../lib/session";
import { usePolling } from "../../lib/usePolling";

// Plan v2 §16.2 evaluation numbers: false ticket rate, detection and
// notification latency, repair times and data completeness.

const POLL_INTERVAL_MS = 30000;

const RUN_START_KEY = "simms.stats.runStart";

const PERIODS = [
  { value: "1", label: "24 h" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "RUN", label: "Since run start" },
];

const REVIEW_FILTERS = [
  { value: "UNREVIEWED", label: "Not reviewed" },
  { value: "FALSE_ALARM", label: "False alarms" },
  { value: "GENUINE", label: "Genuine" },
  { value: "ALL", label: "All" },
];

function readRunStart() {
  try {
    return localStorage.getItem(RUN_START_KEY) || "";
  } catch {
    return "";
  }
}

function saveRunStart(value) {
  try {
    if (value) localStorage.setItem(RUN_START_KEY, value);
    else localStorage.removeItem(RUN_START_KEY);
  } catch {
    // Storage unavailable: the value just isn't remembered.
  }
}

function buildQuery(period, runStart, roomId) {
  const params = new URLSearchParams({
    tz_offset_minutes: String(new Date().getTimezoneOffset()),
  });

  if (period === "RUN" && runStart) {
    params.set("start", new Date(runStart).toISOString());
  } else {
    params.set("days", period === "RUN" ? "7" : period);
  }

  if (roomId !== "ALL") params.set("room_id", roomId);

  return params.toString();
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 1) return `${seconds.toFixed(1)} s`;
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)} h`;
  return `${(seconds / 86400).toFixed(1)} d`;
}

function formatRate(value) {
  if (value === null || value === undefined) return "—";
  return value.toFixed(2);
}

function formatPercent(value) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function shortDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Daily tickets chart: stacked bars (false alarms on top of the rest)
// ---------------------------------------------------------------------------

function DailyChart({ daily }) {
  const [hovered, setHovered] = useState(null);
  const [asTable, setAsTable] = useState(false);

  const max = Math.max(1, ...daily.map((day) => day.tickets));
  const hoveredDay = hovered === null ? null : daily[hovered];
  const labelEvery = Math.ceil(daily.length / 8);

  return (
    <Card
      title="Tickets per day"
      subtitle="False alarms are the tickets a supervisor marked as such"
      icon="barChart"
      actions={
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsTable((v) => !v)}>
          <Icon name={asTable ? "barChart" : "layers"} className="h-3.5 w-3.5" />
          {asTable ? "Chart" : "Table"}
        </button>
      }
    >
      {asTable ? (
        <div className="table-wrap max-h-72 overflow-y-auto thin-scrollbar">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col" className="text-right">Tickets</th>
                <th scope="col" className="text-right">False alarms</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((day) => (
                <tr key={day.date}>
                  <td>{shortDate(day.date)}</td>
                  <td className="num text-right">{day.tickets}</td>
                  <td className="num text-right">{day.false_alarms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" aria-hidden="true" />
              Other tickets
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" aria-hidden="true" />
              False alarms
            </span>
            <span className="num ml-auto text-slate-500">
              {hoveredDay
                ? `${shortDate(hoveredDay.date)} · ${hoveredDay.tickets} ticket${hoveredDay.tickets === 1 ? "" : "s"}, ${hoveredDay.false_alarms} false`
                : `Peak ${max} / day`}
            </span>
          </div>

          <div className="relative h-48 border-b border-slate-200" onMouseLeave={() => setHovered(null)}>
            <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-slate-100" aria-hidden="true" />
            <div className="flex h-full items-end gap-[2px]">
              {daily.map((day, index) => {
                const other = day.tickets - day.false_alarms;
                const active = hovered === index;

                return (
                  <button
                    key={day.date}
                    type="button"
                    className="flex h-full min-w-0 flex-1 flex-col justify-end rounded-t focus-visible:outline-2"
                    onMouseEnter={() => setHovered(index)}
                    onFocus={() => setHovered(index)}
                    onBlur={() => setHovered(null)}
                    aria-label={`${shortDate(day.date)}: ${day.tickets} tickets, ${day.false_alarms} false alarms`}
                    style={{ background: active ? "var(--color-slate-100)" : undefined }}
                  >
                    {day.false_alarms > 0 && (
                      <span
                        className={`block w-full bg-amber-500 ${other > 0 ? "rounded-t-[4px] border-b-2 border-surface" : "rounded-t-[4px]"}`}
                        style={{ height: `${(day.false_alarms / max) * 100}%` }}
                      />
                    )}
                    {other > 0 && (
                      <span
                        className={`block w-full bg-brand-500 ${day.false_alarms > 0 ? "" : "rounded-t-[4px]"}`}
                        style={{ height: `${(other / max) * 100}%` }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-1.5 flex gap-[2px] text-[10.5px] text-slate-500">
            {daily.map((day, index) => (
              <span key={day.date} className="num min-w-0 flex-1 truncate text-center">
                {index % labelEvery === 0 ? shortDate(day.date) : ""}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

function VerdictButtons({ ticket, pending, onReview }) {
  const busy = pending === ticket.ticket_id;

  const button = (verdict, label, activeClass) => {
    const active = ticket.verdict === verdict;

    return (
      <button
        type="button"
        disabled={busy}
        aria-pressed={active}
        onClick={() => onReview(ticket, active ? null : verdict)}
        className={`btn btn-sm ${active ? activeClass : "btn-secondary"}`}
      >
        {active && <Icon name="check" className="h-3.5 w-3.5" />}
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {button("GENUINE", "Genuine", "btn-success")}
      {button("FALSE_ALARM", "False alarm", "btn-danger-soft")}
    </div>
  );
}

function ReviewQueue({ tickets, pending, onReview, canOpen }) {
  const [filter, setFilter] = useState("UNREVIEWED");

  const counts = useMemo(
    () => ({
      UNREVIEWED: tickets.filter((t) => !t.verdict).length,
      FALSE_ALARM: tickets.filter((t) => t.verdict === "FALSE_ALARM").length,
      GENUINE: tickets.filter((t) => t.verdict === "GENUINE").length,
      ALL: tickets.length,
    }),
    [tickets]
  );

  const visible = tickets.filter((ticket) =>
    filter === "ALL" ? true : filter === "UNREVIEWED" ? !ticket.verdict : ticket.verdict === filter
  );

  return (
    <Card
      title="Review tickets"
      subtitle="Mark each ticket as a genuine fault or a false alarm. Only marked tickets count towards the false ticket rate."
      icon="clipboard"
      bodyClassName=""
    >
      <div className="border-b border-slate-100 px-5 py-3">
        <Segmented
          options={REVIEW_FILTERS.map((option) => ({ ...option, count: counts[option.value] }))}
          value={filter}
          onChange={setFilter}
          ariaLabel="Review filter"
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="checkCircle"
          title={filter === "UNREVIEWED" ? "Everything is reviewed" : "No tickets here"}
          description="Tickets raised in the selected period appear in this list."
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {visible.map((ticket) => (
            <li key={ticket.ticket_id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {canOpen ? (
                    <button
                      type="button"
                      className="num text-sm font-semibold text-brand-600 hover:underline"
                      onClick={() => navigateTo(`/supervisor/tickets/${ticket.ticket_id}`)}
                    >
                      #{ticket.ticket_id}
                    </button>
                  ) : (
                    <span className="num text-sm font-semibold text-slate-900">#{ticket.ticket_id}</span>
                  )}
                  <span className="text-sm font-semibold text-slate-900">{ticket.fault_name}</span>
                  {ticket.device_name && <span className="text-sm text-slate-600">· {ticket.device_name}</span>}
                  <StatusBadge status={ticket.priority} dot={false} size="sm" />
                  <StatusBadge status={ticket.status} size="sm" />
                  {ticket.was_reopened && <StatusBadge status="REOPENED" label="Was reopened" size="sm" />}
                </div>
                <p className="num mt-1 text-xs text-slate-500">
                  {ticket.room_name} · {formatDateTime(ticket.created_at)} · confirmed in {formatDuration(ticket.confirmation_seconds)}
                </p>
              </div>
              <VerdictButtons ticket={ticket} pending={pending} onReview={onReview} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SupervisorStatistics() {
  const role = localStorage.getItem("role");

  const [period, setPeriod] = useState("7");
  const [runStart, setRunStart] = useState(readRunStart);
  const [roomId, setRoomId] = useState("ALL");
  const [rooms, setRooms] = useState([]);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [pendingReview, setPendingReview] = useState(null);

  const query = buildQuery(period, runStart, roomId);

  const loadStats = useCallback(
    async ({ silent = false, nextQuery } = {}) => {
      if (!silent) setRefreshing(true);

      try {
        const data = await apiFetch(`/stats/overview?${nextQuery ?? query}`);
        setStats(data);
        setError("");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query]
  );

  useEffect(() => {
    apiFetch("/classrooms")
      .then((data) => setRooms(Array.isArray(data) ? data : []))
      .catch(() => setRooms([]));
  }, []);

  usePolling(loadStats, POLL_INTERVAL_MS, { immediate: true });

  // Filters reload straight away instead of waiting for the next poll.
  const applyFilters = (next) => {
    const filters = { period, runStart, roomId, ...next };

    setPeriod(filters.period);
    setRunStart(filters.runStart);
    setRoomId(filters.roomId);
    loadStats({ nextQuery: buildQuery(filters.period, filters.runStart, filters.roomId) });
  };

  const reviewTicket = async (ticket, verdict) => {
    setPendingReview(ticket.ticket_id);

    try {
      if (verdict) {
        await apiFetch(`/stats/tickets/${ticket.ticket_id}/review`, {
          method: "PUT",
          body: { verdict },
        });
      } else {
        await apiFetch(`/stats/tickets/${ticket.ticket_id}/review`, { method: "DELETE" });
      }

      await loadStats({ silent: true });
    } catch (err) {
      setNotice({ tone: "danger", text: err.message });
    } finally {
      setPendingReview(null);
    }
  };

  const changeRunStart = (value) => {
    saveRunStart(value);
    applyFilters({ runStart: value });
  };

  const summary = stats?.summary;
  const latency = stats?.latency;
  const targets = stats?.targets;

  const falseRate = summary?.false_alarms_per_room_day;
  const falseRateTone =
    falseRate === null || falseRate === undefined ? "neutral" : falseRate <= targets.false_alarms_per_room_day ? "success" : "danger";

  const confirmMedian = latency?.confirmation.median;
  const confirmTone =
    confirmMedian === null || confirmMedian === undefined
      ? "neutral"
      : confirmMedian <= targets.detection_latency_seconds
        ? "success"
        : "warning";

  const roomOptions = [
    { value: "ALL", label: "All rooms" },
    ...rooms.map((room) => ({ value: String(room.room_id), label: room.room_name })),
  ];

  return (
    <AppShell
      eyebrow="Evaluation"
      title="Statistics"
      wide
      actions={<RefreshButton onClick={() => loadStats()} loading={refreshing} />}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented options={PERIODS} value={period} onChange={(value) => applyFilters({ period: value })} ariaLabel="Period" />

        {period === "RUN" && (
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Run started
            <input
              type="datetime-local"
              className="input h-9 w-auto"
              value={runStart}
              onChange={(event) => changeRunStart(event.target.value)}
            />
          </label>
        )}

        {rooms.length > 1 && (
          <select
            className="select h-9 w-auto min-w-36"
            value={roomId}
            onChange={(event) => applyFilters({ roomId: event.target.value })}
            aria-label="Classroom"
          >
            {roomOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {stats && (
          <p className="num ml-auto text-xs text-slate-500">
            {formatDateTime(stats.period.start)} → {formatDateTime(stats.period.end)} · {stats.period.rooms} room
            {stats.period.rooms === 1 ? "" : "s"} · {stats.period.room_days.toFixed(1)} room-days
          </p>
        )}
      </div>

      {period === "RUN" && !runStart && (
        <Alert tone="info" title="Set when the unattended run started" className="mb-4">
          Until then the last 7 days are shown.
        </Alert>
      )}

      {error && (
        <Alert tone="danger" title="Unable to load statistics" onRetry={() => loadStats()} className="mb-4">
          {error}
        </Alert>
      )}

      {notice && (
        <Alert tone={notice.tone} onDismiss={() => setNotice(null)} className="mb-4">
          {notice.text}
        </Alert>
      )}

      {loading ? (
        <Card>
          <SkeletonRows rows={5} />
        </Card>
      ) : !stats ? null : (
        <div className="space-y-6">
          {summary.unreviewed > 0 && (
            <Alert tone="warning" title={`${summary.unreviewed} ticket${summary.unreviewed === 1 ? "" : "s"} not reviewed yet`}>
              The false ticket rate counts only tickets marked as false alarms. Review them below for an honest figure.
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="False tickets / room / day"
              value={formatRate(falseRate)}
              hint={`Target ≤ ${targets.false_alarms_per_room_day} · ${summary.false_alarms} false of ${summary.tickets}`}
              icon="target"
              tone={falseRateTone}
            />
            <StatCard
              label="Tickets / room / day"
              value={formatRate(summary.tickets_per_room_day)}
              hint={`${summary.tickets} ticket${summary.tickets === 1 ? "" : "s"} raised`}
              icon="ticket"
              tone="brand"
            />
            <StatCard
              label="Confirmation delay"
              value={formatDuration(confirmMedian)}
              hint={`Median · p90 ${formatDuration(latency.confirmation.p90)} · target ≤ ${targets.detection_latency_seconds / 60} min`}
              icon="clock"
              tone={confirmTone}
            />
            <StatCard
              label="Ticket → notification"
              value={formatDuration(latency.notification.median)}
              hint={`Median, server side · max ${formatDuration(latency.notification.max)}`}
              icon="bell"
              tone="info"
            />
            <StatCard
              label="Auto-resolved"
              value={String(summary.auto_resolved)}
              hint={`Cleared before anyone acted · ${formatPercent(summary.tickets ? summary.auto_resolved / summary.tickets : null)}`}
              icon="checkCircle"
              tone="neutral"
            />
            <StatCard
              label="Reopened"
              value={String(summary.reopened)}
              hint={`Failed verification or recurred · ${summary.recurrences} recurrence${summary.recurrences === 1 ? "" : "s"}`}
              icon="history"
              tone={summary.reopened ? "warning" : "neutral"}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <DailyChart daily={stats.daily} />
            </div>

            <Card title="Repair times" subtitle="From ticket creation" icon="wrench" className="xl:col-span-2">
              <dl className="grid grid-cols-3 gap-y-4 text-sm">
                {[
                  ["Marked resolved", latency.repair],
                  ["Closed (verified)", latency.close],
                  ["Fault confirmed", latency.confirmation],
                ].map(([label, dist]) => (
                  <div key={label} className="contents">
                    <dt className="col-span-3 -mb-3 text-xs font-medium text-slate-500">
                      {label} <span className="num">({dist.count})</span>
                    </dt>
                    <dd className="num font-semibold text-slate-900">
                      {formatDuration(dist.median)} <span className="text-[11px] font-normal text-slate-500">median</span>
                    </dd>
                    <dd className="num font-semibold text-slate-900">
                      {formatDuration(dist.p90)} <span className="text-[11px] font-normal text-slate-500">p90</span>
                    </dd>
                    <dd className="num font-semibold text-slate-900">
                      {formatDuration(dist.max)} <span className="text-[11px] font-normal text-slate-500">max</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Confirmation delay runs from the first abnormal reading to the 4-of-5 confirmation. The physical
                fault starts up to one reading interval earlier.
              </p>
            </Card>
          </div>

          <Card title="By fault type" icon="alert" bodyClassName="">
            {stats.by_type.length === 0 ? (
              <EmptyState icon="inbox" title="No tickets in this period" />
            ) : (
              <div className="table-wrap rounded-none border-0">
                <table className="table min-w-[760px]">
                  <thead>
                    <tr>
                      <th scope="col">Fault</th>
                      <th scope="col">Priority</th>
                      <th scope="col" className="text-right">Tickets</th>
                      <th scope="col" className="text-right">Genuine</th>
                      <th scope="col" className="text-right">False</th>
                      <th scope="col" className="text-right">Not reviewed</th>
                      <th scope="col" className="text-right">Auto-resolved</th>
                      <th scope="col" className="text-right">Reopened</th>
                      <th scope="col" className="text-right">Confirmation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.by_type.map((row) => (
                      <tr key={row.fault_type}>
                        <td className="font-semibold text-slate-900">{row.fault_name}</td>
                        <td>{row.priority ? <StatusBadge status={row.priority} dot={false} size="sm" /> : "—"}</td>
                        <td className="num text-right">{row.tickets}</td>
                        <td className="num text-right">{row.genuine}</td>
                        <td className="num text-right">{row.false_alarms}</td>
                        <td className="num text-right">{row.unreviewed}</td>
                        <td className="num text-right">{row.auto_resolved}</td>
                        <td className="num text-right">{row.reopened}</td>
                        <td className="num text-right">{formatDuration(row.confirmation_median_seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Per classroom" icon="classroom" bodyClassName="">
              <div className="table-wrap rounded-none border-0">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Classroom</th>
                      <th scope="col" className="text-right">Tickets</th>
                      <th scope="col" className="text-right">False</th>
                      <th scope="col" className="text-right">False / day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.by_room.map((row) => (
                      <tr key={row.room_id}>
                        <td className="font-semibold text-slate-900">{row.room_name}</td>
                        <td className="num text-right">{row.tickets}</td>
                        <td className="num text-right">{row.false_alarms}</td>
                        <td className="num text-right">{formatRate(row.false_alarms_per_room_day)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card
              title="Data completeness"
              subtitle="Share of 5-minute slots with at least one reading"
              icon="server"
            >
              <ul className="space-y-4">
                {stats.coverage.map((room) => (
                  <li key={room.room_id}>
                    <p className="mb-2 text-sm font-semibold text-slate-900">{room.room_name}</p>
                    {[
                      ["ESP32 node", room.sensor],
                      ["Camera", room.vision],
                    ].map(([label, source]) => (
                      <div key={label} className="mb-2 grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3 text-xs">
                        <span className="text-slate-600">{label}</span>
                        <ScoreBar value={(source?.coverage ?? 0) * 100} />
                        <span className="num text-right font-semibold text-slate-900">
                          {source ? formatPercent(source.coverage) : "0%"}
                        </span>
                      </div>
                    ))}
                    <p className="num text-[11px] text-slate-500">
                      {room.sensor ? `${room.sensor.readings.toLocaleString()} node readings` : "No node readings"}
                      {" · "}
                      {room.vision ? `${room.vision.readings.toLocaleString()} camera readings` : "no camera readings"}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <ReviewQueue
            tickets={stats.tickets}
            pending={pendingReview}
            onReview={reviewTicket}
            canOpen={role === "SUPERVISOR"}
          />

          <p className="text-xs leading-relaxed text-slate-500">
            Not measured here: missed-fault rate and detector accuracy. Those need injected-fault trials and labelled
            frames (Plan v2 §16.2).
          </p>
        </div>
      )}
    </AppShell>
  );
}
