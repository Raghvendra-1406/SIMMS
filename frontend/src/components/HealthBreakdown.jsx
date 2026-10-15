import { HEALTH_COMPONENT_ORDER, healthDetailText } from "../lib/health";

/** What the classroom health score (CIHS, Plan v2 §10) lost points for. */
export default function HealthBreakdown({ components }) {
  if (!components) return null;

  return (
    <dl className="space-y-1.5 text-xs">
      {HEALTH_COMPONENT_ORDER.filter((name) => components[name]).map((name) => {
        const c = components[name];

        return (
          <div key={name} className="flex items-baseline gap-2">
            <dt className="w-28 shrink-0 text-slate-500">{c.label}</dt>
            <dd className="min-w-0 flex-1 truncate text-slate-600">{healthDetailText(name, c)}</dd>
            <dd className={`num shrink-0 font-semibold ${c.points > 0 ? "text-slate-900" : "text-slate-400"}`}>
              {c.points > 0 ? `−${c.points}` : "0"}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
