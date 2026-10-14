import { useCallback, useState } from "react";
import Icon from "./Icon";
import { Alert, Card, StatusBadge } from "./ui";
import { apiFetch } from "../lib/api";
import { usePolling } from "../lib/usePolling";

// Commissioning for circuit-level metering: the backend derives how
// many fans / tube lights are on from each circuit's current divided
// by the current of one unit. This card shows the live circuits and
// learns the per-unit current from a known number of units.

const CIRCUITS = [
  { key: "LIGHTS", label: "Lights circuit", unit: "tube light", icon: "lightbulb" },
  { key: "FANS", label: "Fans circuit", unit: "fan", icon: "fan" },
];

function format(value, digits = 2) {
  if (value === null || value === undefined) return "—";
  return Number(value).toFixed(digits);
}

export default function CircuitBaselines({ roomId }) {
  const [circuits, setCircuits] = useState(null);
  const [unitsOn, setUnitsOn] = useState({ LIGHTS: "", FANS: "" });
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    try {
      setCircuits(await apiFetch(`/classrooms/${roomId}/circuits`));
    } catch (err) {
      setMessage({ tone: "danger", text: err.message });
    }
  }, [roomId]);

  usePolling(load, 5000, { immediate: true, enabled: Boolean(roomId) });

  const learn = async (circuit, count) => {
    setBusy(circuit);
    setMessage(null);

    try {
      const result = await apiFetch(`/classrooms/${roomId}/circuits/${circuit}/learn`, {
        method: "POST",
        body: { units_on: count },
      });

      setMessage({
        tone: "success",
        text:
          count === 0
            ? `${circuit}: standby current set to ${format(result.standby_current_a)} A.`
            : `${circuit}: ${format(result.unit_current_a, 3)} A per unit, learned from ${format(result.measured_current_a)} A with ${count} on.`,
      });

      load();
    } catch (err) {
      setMessage({ tone: "danger", text: err.message });
    } finally {
      setBusy("");
    }
  };

  return (
    <Card
      title="Circuits"
      subtitle="Per-unit current used to count how many lights and fans are on"
      icon="zap"
      className="mt-6"
    >
      {message && (
        <Alert tone={message.tone} onDismiss={() => setMessage(null)} className="mb-4">
          {message.text}
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {CIRCUITS.map(({ key, label, unit, icon }) => {
          const circuit = circuits?.[key];
          const count = unitsOn[key];

          return (
            <section key={key} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                  <Icon name={icon} className="h-4 w-4 text-slate-500" />
                  {label}
                </p>
                {circuit &&
                  (circuit.baseline_learned ? (
                    <StatusBadge tone="success" size="sm" label="Learned" />
                  ) : (
                    <StatusBadge tone="warning" size="sm" label="Default" />
                  ))}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <dt className="text-[11.5px] text-slate-500">Now</dt>
                  <dd className="num text-sm font-semibold text-slate-900">{format(circuit?.current)} A</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-slate-500">Units on</dt>
                  <dd className="num text-sm font-semibold text-slate-900">
                    {circuit?.powered_units ?? "—"}/{circuit?.units_total ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-slate-500">Per {unit}</dt>
                  <dd className="num text-sm font-semibold text-slate-900">{format(circuit?.unit_current_a, 3)} A</dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-slate-500">Standby</dt>
                  <dd className="num text-sm font-semibold text-slate-900">{format(circuit?.standby_current_a, 3)} A</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor={`units-${key}`} className="label">
                    {unit}s switched on now
                  </label>
                  <input
                    id={`units-${key}`}
                    type="number"
                    min={1}
                    max={circuit?.units_total || 50}
                    value={count}
                    onChange={(event) => setUnitsOn((previous) => ({ ...previous, [key]: event.target.value }))}
                    className="input w-28"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy === key || !(Number(count) > 0)}
                  onClick={() => learn(key, Number(count))}
                >
                  Learn per-unit current
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy === key}
                  onClick={() => learn(key, 0)}
                  title={`Switch every ${unit} off first`}
                >
                  Set standby (all off)
                </button>
              </div>
              <p className="help-text">
                Commissioning: switch everything off and set standby, then switch on a known number of {unit}s and learn.
              </p>
            </section>
          );
        })}
      </div>
    </Card>
  );
}
