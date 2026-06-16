const indent = "  ";

export function formatDcl(source: string): string {
  const normalized = source.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const formatted: string[] = [];
  let depth = 0;
  let blankRun = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      blankRun += 1;
      if (blankRun <= 2) formatted.push("");
      continue;
    }

    blankRun = 0;
    if (trimmed.startsWith("}")) depth = Math.max(0, depth - 1);

    formatted.push(`${indent.repeat(depth)}${trimmed}`);

    if (trimmed.endsWith("{")) depth += 1;
  }

  while (formatted.length > 0 && formatted[formatted.length - 1] === "") {
    formatted.pop();
  }

  return formatted.length ? `${formatted.join("\n")}\n` : "";
}
