const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export function sitePath(href: string): string {
  return `${base}${href}`;
}

export function playgroundExamplePath(exampleId: string): string {
  return `${sitePath("/playground/")}?example=${encodeURIComponent(exampleId)}`;
}
