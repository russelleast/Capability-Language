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

export type WrappedGraphLabelLine = {
  text: string;
  index: number;
};

export function wrapGraphLabel(value: string, maxLength: number): WrappedGraphLabelLine[] {
  const words = displayNameForGraph(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const parts = splitLongWord(word, maxLength);
    for (const part of parts) {
      const next = current ? `${current} ${part}` : part;
      if (next.length > maxLength && current) {
        lines.push(current);
        current = part;
      } else {
        current = next;
      }
    }
  }

  if (current) lines.push(current);
  return lines.map((text, index) => ({ text, index }));
}

function titleCasePart(value: string): string {
  if (!value) return value;
  if (value.toUpperCase() === value && /[A-Z]/.test(value)) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function splitLongWord(value: string, maxLength: number): string[] {
  if (maxLength <= 0 || value.length <= maxLength) return [value];
  const parts: string[] = [];
  for (let index = 0; index < value.length; index += maxLength) {
    parts.push(value.slice(index, index + maxLength));
  }
  return parts;
}
