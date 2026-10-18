// Classroom health score (CIHS, Plan v2 §10) breakdown helpers.
// components: { electrical|board|maintenance|monitoring: {label, penalty,
// weight, points, ...details} } from the backend.

export const HEALTH_COMPONENT_ORDER = ["electrical", "maintenance", "monitoring", "board"];

export function healthDetailText(name, c) {
  switch (name) {
    case "electrical":
      if (c.electrical_abnormality) return "Electrical abnormality active";
      return c.units ? `${c.faulty_units} of ${c.units} faulty` : "No fans or lights registered";
    case "board":
      return c.pending ? `Waiting ${c.hours} h for cleaning` : "Clean";
    case "maintenance":
      return c.open_tickets
        ? `${c.open_tickets} open${c.overdue ? `, ${c.overdue} overdue` : ""}`
        : "No open tickets";
    case "monitoring":
      return c.monitored ? `${c.offline} of ${c.devices} offline` : "No devices registered";
    default:
      return "";
  }
}

/** One line per component, for tooltips. */
export function healthSummaryText(components) {
  if (!components) return "";
  return HEALTH_COMPONENT_ORDER.filter((name) => components[name])
    .map((name) => `${components[name].label}: −${components[name].points} (${healthDetailText(name, components[name])})`)
    .join("\n");
}
