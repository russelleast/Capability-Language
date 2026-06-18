import { buildArchitectureOverviewGraph, ArchitectureOverviewDetailLevel } from "./DclArchitectureOverviewGraphBuilder";
import { buildCapabilityGraph } from "./DclCapabilityGraphBuilder";
import { buildContextMapGraph } from "./DclContextMapGraphBuilder";
import { buildEventFlowGraph } from "./DclEventFlowGraphBuilder";
import { graphExportBaseName } from "./DclGraphExport";
import { buildLifecycleGraph } from "./DclLifecycleGraphBuilder";
import { DclGraphModel } from "./DclGraphModel";
import { SemanticSummary } from "../views/semanticSummary";

export type DclGraphWorkspaceType = "architecture" | "capability" | "lifecycle" | "event-flow" | "context-map";

export const ALL_EVENT_FLOWS = "__all_event_flows__";
export const ALL_CONTEXTS = "__all_contexts__";

export type DclGraphWorkspaceSelection = {
  graphType?: DclGraphWorkspaceType;
  subject?: string;
  architectureDetailLevel?: ArchitectureOverviewDetailLevel;
};

export type DclGraphWorkspaceOption = {
  label: string;
  value: string;
  description?: string;
};

export type DclGraphWorkspaceState = {
  graphType: DclGraphWorkspaceType;
  graphTypes: DclGraphWorkspaceOption[];
  subject?: string;
  subjects: DclGraphWorkspaceOption[];
  architectureDetailLevel: ArchitectureOverviewDetailLevel;
  graph?: DclGraphModel;
  exportBaseName: string;
  emptyTitle?: string;
  emptyMessage?: string;
};

export function buildGraphWorkspaceState(
  summary: SemanticSummary,
  selection: DclGraphWorkspaceSelection = {},
): DclGraphWorkspaceState {
  const graphType = selection.graphType ?? "architecture";
  const architectureDetailLevel = selection.architectureDetailLevel ?? "overview";
  const subjects = subjectOptions(summary, graphType);
  const subject = selectedSubject(selection.subject, subjects, graphType);
  const graph = buildSelectedGraph(summary, graphType, subject, architectureDetailLevel);
  const empty = graph ? undefined : emptyState(summary, graphType, subject);

  return {
    graphType,
    graphTypes: graphTypeOptions(),
    subject,
    subjects,
    architectureDetailLevel,
    graph,
    exportBaseName: graphExportBaseName(graphType, subject),
    emptyTitle: empty?.title,
    emptyMessage: empty?.message,
  };
}

function buildSelectedGraph(
  summary: SemanticSummary,
  graphType: DclGraphWorkspaceType,
  subject: string | undefined,
  architectureDetailLevel: ArchitectureOverviewDetailLevel,
): DclGraphModel | undefined {
  switch (graphType) {
    case "architecture":
      return summary.contexts?.length || summary.capabilities.length
        ? buildArchitectureOverviewGraph(summary, architectureDetailLevel)
        : undefined;
    case "capability":
      return subject ? buildCapabilityGraph(summary, subject) : undefined;
    case "lifecycle":
      return subject ? buildLifecycleGraph(summary, subject) : undefined;
    case "event-flow":
      return buildEventFlowGraph(summary, subject === ALL_EVENT_FLOWS ? undefined : subject);
    case "context-map":
      return buildContextMapGraph(summary, subject === ALL_CONTEXTS ? undefined : subject);
  }
}

function selectedSubject(
  requested: string | undefined,
  subjects: DclGraphWorkspaceOption[],
  graphType: DclGraphWorkspaceType,
): string | undefined {
  if (graphType === "architecture") return undefined;
  if (requested && subjects.some((subject) => subject.value === requested)) return requested;
  return subjects[0]?.value;
}

function subjectOptions(summary: SemanticSummary, graphType: DclGraphWorkspaceType): DclGraphWorkspaceOption[] {
  switch (graphType) {
    case "architecture":
      return [];
    case "capability":
      return summary.capabilities.map((capability) => ({
        label: capability.name,
        value: capability.name,
        description: capability.context,
      }));
    case "lifecycle":
      return summary.capabilities
        .filter((capability) => capability.lifecycle)
        .map((capability) => ({
          label: capability.name,
          value: capability.name,
          description: capability.context,
        }));
    case "event-flow":
      return eventNames(summary).length
        ? [
          { label: "All event flows", value: ALL_EVENT_FLOWS },
          ...eventNames(summary).map((event) => ({ label: event, value: event })),
        ]
        : [];
    case "context-map":
      return summary.contexts?.length
        ? [
          { label: "All contexts", value: ALL_CONTEXTS },
          ...summary.contexts.map((context) => ({
            label: context.name,
            value: context.name,
            description: context.parent ? `child of ${context.parent}` : undefined,
          })),
        ]
        : [];
  }
}

function eventNames(summary: SemanticSummary): string[] {
  const names = new Set<string>();
  for (const event of summary.events ?? []) names.add(event.label);
  for (const capability of summary.capabilities) {
    for (const event of capability.eventDetails ?? []) names.add(event.event);
    for (const transition of capability.lifecycle?.transitionDetails ?? []) {
      if (transition.triggerKind === "event" && transition.triggerName) names.add(transition.triggerName);
    }
  }
  return Array.from(names).sort();
}

function emptyState(
  summary: SemanticSummary,
  graphType: DclGraphWorkspaceType,
  subject: string | undefined,
): { title: string; message: string } {
  switch (graphType) {
    case "architecture":
      return {
        title: "No Architecture Items",
        message: "The compiled semantic summary does not include contexts or capabilities.",
      };
    case "capability":
      return {
        title: "No Capability Available",
        message: summary.capabilities.length
          ? `No compiler summary found for capability '${subject ?? ""}'.`
          : "The compiled semantic summary does not include capabilities.",
      };
    case "lifecycle":
      return {
        title: "No Lifecycle Available",
        message: summary.capabilities.some((capability) => capability.lifecycle)
          ? `No lifecycle graph is available for '${subject ?? ""}'.`
          : "The compiled semantic summary does not include lifecycle data.",
      };
    case "event-flow":
      return {
        title: "No Events Declared",
        message: "The compiled semantic summary does not include declared or referenced events.",
      };
    case "context-map":
      return {
        title: "No Contexts Declared",
        message: "The compiled semantic summary does not include declared contexts.",
      };
  }
}

function graphTypeOptions(): DclGraphWorkspaceOption[] {
  return [
    { label: "Architecture Overview", value: "architecture" },
    { label: "Capability Graph", value: "capability" },
    { label: "Lifecycle Graph", value: "lifecycle" },
    { label: "Event Flow Graph", value: "event-flow" },
    { label: "Context Map", value: "context-map" },
  ];
}
