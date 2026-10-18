import { useState } from "react";
import Icon from "./Icon";
import { Card, EmptyState, StatCard } from "./ui";

// Energy wasted in empty rooms (Plan v2 C5): LIGHTS + FANS circuit
// energy while the room had been empty longer than the grace period.

const SERIES = [
  { key: "occupied_kwh", label: "In use", swatch: "bg-brand-500" },
  { key: "wasted_kwh", label: "Wasted (empty room)", swatch: "bg-amber-500" },
  { key: "unknown_kwh", label: "Unknown (no camera)", swatch: "bg-slate-300" },
];

function kwh(value, digits = 2) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(value < 1 ? Math.max(digits, 3) : digits)} kWh`;
}

function money(value, currency) {
  if (value === null || value === undefined) return "—";
  return `${currency}${value.toFixed(value < 10 ? 2 : 0)}`;
}

function percent(value) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

function hours(value) {
  if (!value) return "0 h";
  return value < 1 ? `${Math.round(value * 60)} min` : `${value.toFixed(1)} h`;
}

function shortDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function EnergyChart({ daily }) {
  const [hovered, setHovered] = useState(null);
  const [asTable, setAsTable] = useState(false);

  const totalOf = (day) => SERIES.reduce((sum, series) => sum + day[series.key], 0);
  const max = Math.max(0.001, ...daily.map(totalOf));
  const hoveredDay = hovered === null ? null : daily[hovered];
  const labelEvery = Math.ceil(daily.length / 8);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        {SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${series.swatch}`} aria-hidden="true" />
            {series.label}
          </span>
        ))}
        <button type="button" className="btn btn-ghost btn-sm ml-auto" onClick={() => setAsTable((v) => !v)}>
          <Icon name={asTable ? "barChart" : "layers"} className="h-3.5 w-3.5" />
          {asTable ? "Chart" : "Table"}
        </button>
      </div>

      {asTable ? (
        <div className="table-wrap max-h-72 overflow-y-auto thin-scrollbar">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                {SERIES.map((series) => (
                  <th key={series.key} scope="col" className="text-right">
                    {series.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {daily.map((day) => (
                <tr key={day.date}>
                  <td>{shortDate(day.date)}</td>
                  {SERIES.map((series) => (
                    <td key={series.key} className="num text-right">
                      {day[series.key].toFixed(3)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <p className="num mb-2 h-4 text-right text-xs text-slate-500">
            {hoveredDay
              ? `${shortDate(hoveredDay.date)} · in use ${hoveredDay.occupied_kwh.toFixed(2)} · wasted ${hoveredDay.wasted_kwh.toFixed(2)} · unknown ${hoveredDay.unknown_kwh.toFixed(2)} kWh`
              : `Peak ${max.toFixed(2)} kWh / day`}
          </p>
          <div className="h-44 border-b border-slate-200" onMouseLeave={() => setHovered(null)}>
            <div className="flex h-full items-end gap-[2px]">
              {daily.map((day, index) => {
                const parts = SERIES.filter((series) => day[series.key] > 0);

                return (
                  <button
                    key={day.date}
                    type="button"
                    className="flex h-full min-w-0 flex-1 flex-col-reverse justify-start rounded-t"
                    onMouseEnter={() => setHovered(index)}
                    onFocus={() => setHovered(index)}
                    onBlur={() => setHovered(null)}
                    aria-label={`${shortDate(day.date)}: ${SERIES.map((s) => `${s.label} ${day[s.key].toFixed(2)} kWh`).join(", ")}`}
                    style={{ background: hovered === index ? "var(--color-slate-100)" : undefined }}
                  >
                    {parts.map((series, partIndex) => (
                      <span
                        key={series.key}
                        className={`block w-full ${series.swatch} ${partIndex === parts.length - 1 ? "rounded-t-[4px]" : "border-t-2 border-surface"}`}
                        style={{ height: `${(day[series.key] / max) * 100}%` }}
                      />
                    ))}
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
    </div>
  );
}

export default function EnergyReport({ energy, loading }) {
  if (loading && !energy) {
    return (
      <Card title="Energy wasted in empty rooms" icon="zap">
        <p className="text-sm text-slate-500">Calculating…</p>
      </Card>
    );
  }

  if (!energy) return null;

  const { totals, assumptions } = energy;
  const currency = assumptions.currency;
  const hasData = totals.monitored_hours > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Energy wasted"
          value={kwh(totals.wasted_kwh)}
          hint={`${percent(totals.wasted_share)} of lights + fans energy · lights ${kwh(totals.wasted_lights_kwh)}, fans ${kwh(totals.wasted_fans_kwh)}`}
          icon="zap"
          tone={totals.wasted_kwh > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Cost of waste"
          value={money(totals.wasted_cost, currency)}
          hint={`At ${currency}${assumptions.tariff_per_kwh}/kWh`}
          icon="trendingUp"
          tone="neutral"
        />
        <StatCard
          label="CO₂ from waste"
          value={`${totals.wasted_co2_kg.toFixed(totals.wasted_co2_kg < 10 ? 2 : 0)} kg`}
          hint={`At ${assumptions.emission_kg_per_kwh} kg CO₂/kWh (grid)`}
          icon="sun"
          tone="neutral"
        />
        <StatCard
          label="Left on in empty rooms"
          value={hours(totals.wasted_hours)}
          hint={`Of ${hours(totals.monitored_hours)} monitored · empty > ${assumptions.vacancy_minutes} min`}
          icon="clock"
          tone={totals.wasted_hours > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card
          title="Energy per day"
          subtitle="Lights and fans circuits"
          icon="barChart"
          className="xl:col-span-3"
        >
          {hasData ? (
            <EnergyChart daily={energy.daily} />
          ) : (
            <EmptyState icon="zap" title="No meter readings in this period" />
          )}
        </Card>

        <Card title="Longest waste" subtitle="Lights or fans on in an empty room" icon="alert" className="xl:col-span-2" bodyClassName="">
          {energy.top_events.length === 0 ? (
            <EmptyState icon="checkCircle" title="No waste recorded" description="Nothing was left on in an empty room in this period." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {energy.top_events.map((event) => (
                <li key={`${event.room_id}-${event.start}`} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{event.room_name}</p>
                    <p className="num text-xs text-slate-500">
                      {formatTime(event.start)} · {Math.round(event.minutes)} min
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num font-semibold text-slate-900">{kwh(event.kwh)}</p>
                    <p className="num text-xs text-slate-500">{money(event.kwh * assumptions.tariff_per_kwh, currency)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {energy.rooms.length > 1 && (
        <Card title="Energy by classroom" icon="classroom" bodyClassName="">
          <div className="table-wrap rounded-none border-0">
            <table className="table min-w-[640px]">
              <thead>
                <tr>
                  <th scope="col">Classroom</th>
                  <th scope="col" className="text-right">Lights + fans</th>
                  <th scope="col" className="text-right">Wasted</th>
                  <th scope="col" className="text-right">Share</th>
                  <th scope="col" className="text-right">Cost</th>
                  <th scope="col" className="text-right">Left on</th>
                </tr>
              </thead>
              <tbody>
                {energy.rooms.map((room) => (
                  <tr key={room.room_id}>
                    <td className="font-semibold text-slate-900">{room.room_name}</td>
                    <td className="num text-right">{kwh(room.total_kwh)}</td>
                    <td className="num text-right">{kwh(room.wasted_kwh)}</td>
                    <td className="num text-right">{percent(room.wasted_share)}</td>
                    <td className="num text-right">{money(room.wasted_cost, currency)}</td>
                    <td className="num text-right">{hours(room.wasted_hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="text-xs leading-relaxed text-slate-500">
        Waste counts only after a room has been empty for {assumptions.vacancy_minutes} min (people stepping out are not
        waste). {kwh(totals.unknown_kwh)} had no recent camera count and is not counted either way; meter gaps
        (node offline) total {hours(totals.gap_hours)}. Sockets on the main supply are not included.
      </p>
    </div>
  );
}
