import { ALL_CONTEXTS, ALL_EVENT_FLOWS, DclGraphWorkspaceType } from "./DclGraphWorkspaceState";

export type DclGraphExportFormat = "svg" | "png";

export function graphExportBaseName(graphType: DclGraphWorkspaceType, subject?: string): string {
  switch (graphType) {
    case "architecture":
      return "dcl-architecture-overview";
    case "capability":
      return `dcl-capability-${kebabSubject(subject)}`;
    case "lifecycle":
      return `dcl-lifecycle-${kebabSubject(subject)}`;
    case "event-flow":
      return `dcl-event-flow-${kebabSubject(subject === ALL_EVENT_FLOWS ? "all-events" : subject)}`;
    case "context-map":
      return `dcl-context-map-${kebabSubject(subject === ALL_CONTEXTS ? "all-contexts" : subject)}`;
  }
}

export function graphExportFilename(graphType: DclGraphWorkspaceType, subject: string | undefined, format: DclGraphExportFormat): string {
  return `${graphExportBaseName(graphType, subject)}.${format}`;
}

function kebabSubject(subject: string | undefined): string {
  return (subject ?? "graph")
    .trim()
    .replace(/[.]+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "graph";
}
