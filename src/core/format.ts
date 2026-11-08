// Unknown is a dash, never zero

export function formatValue(value: unknown, digits?: number): string {
  if (value === undefined || value === null || (typeof value === "number" && !Number.isFinite(value))) return "-";
  if (typeof value !== "number") return String(value);
  const text = digits === undefined ? String(value) : value.toFixed(digits);
  // Space separator, locale-neutral
  const [int, frac] = text.replace("-", "").split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${value < 0 ? "-" : ""}${grouped}${frac === undefined ? "" : `.${frac}`}`;
}
