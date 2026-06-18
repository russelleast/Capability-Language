export function displayNameForGraph(value: string): string {
  const normalized = value
    .trim()
    .replace(/[.]+/g, " / ")
    .replace(/[-_]+/g, " ")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return value;

  return normalized
    .split(" ")
    .map((part) => part === "/" ? part : titleCasePart(part))
    .join(" ");
}

export function graphSourceName(value: string): string {
  return value;
}

function titleCasePart(value: string): string {
  if (!value) return value;
  if (value.toUpperCase() === value && /[A-Z]/.test(value)) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
