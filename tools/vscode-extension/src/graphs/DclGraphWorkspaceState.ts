import { buildArchitectureOverviewGraph, ArchitectureOverviewDetailLevel } from "./DclArchitectureOverviewGraphBuilder";
import { buildCapabilityGraph } from "./DclCapabilityGraphBuilder";
import { buildContextMapGraph } from "./DclContextMapGraphBuilder";
import { buildEventFlowGraph } from "./DclEventFlowGraphBuilder";
import { graphExportBaseName } from "./DclGraphExport";
import { buildLifecycleGraph } from "./DclLifecycleGraphBuilder";
import { DclGraphModel } from "./DclGraphModel";
import { DclSemanticIdentity, findGraphNodeBySemanticIdentity } from "./DclSemanticIdentity";
import { normalizeContextsForDisplay, SemanticSummary } from "../views/semanticSummary";

export type DclGraphWorkspaceType = "architecture" | "capability" | "lifecycle" | "event-flow" | "context-map";

export const ALL_EVENT_FLOWS = "__all_event_flows__";
export const ALL_CONTEXTS = "__all_contexts__";

export type DclGraphWorkspaceSelection = {
  graphType?: DclGraphWorkspaceType;
  subject?: string;
  architectureDetailLevel?: ArchitectureOverviewDetailLevel;
  focusIdentity?: DclSemanticIdentity;
};

export type DclGraphWorkspaceOption = {
  label: string;
  value: string;
  description?: string;
};

export type DclGraphWorkspaceSyncTarget = {
  label: string;
  graphType: DclGraphWorkspaceType;
  subject?: string;
  architectureDetailLevel?: ArchitectureOverviewDetailLevel;
  focusIdentity: DclSemanticIdentity;
};

export type DclGraphWorkspaceState = {
  graphType: DclGraphWorkspaceType;
  graphTypes: DclGraphWorkspaceOption[];
  subject?: string;
  subjects: DclGraphWorkspaceOption[];
  architectureDetailLevel: ArchitectureOverviewDetailLevel;
  graph?: DclGraphModel;
  focusNodeId?: string;
  graphSyncTargets: Record<string, DclGraphWorkspaceSyncTarget[]>;
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
    focusNodeId: findGraphNodeBySemanticIdentity(graph, selection.focusIdentity)?.id,
    graphSyncTargets: graph ? graphSyncTargetsByNode(summary, graph, graphType) : {},
    exportBaseName: graphExportBaseName(graphType, subject),
    emptyTitle: empty?.title,
    emptyMessage: empty?.message,
  };
}

export function graphSyncTargetsForIdentity(
  summary: SemanticSummary,
  identity: DclSemanticIdentity | undefined,
  currentGraphType?: DclGraphWorkspaceType,
): DclGraphWorkspaceSyncTarget[] {
  if (!identity) return [];

  const targets: DclGraphWorkspaceSyncTarget[] = [];
  const seen = new Set<string>();
  for (const selection of graphSelectionsForIdentity(summary, identity)) {
    if (selection.graphType === currentGraphType) continue;
    const graphType = selection.graphType ?? "architecture";
    const architectureDetailLevel = selection.architectureDetailLevel ?? "overview";
    const graph = buildSelectedGraph(summary, graphType, selection.subject, architectureDetailLevel);
    if (!findGraphNodeBySemanticIdentity(graph, identity)) continue;

    const key = `${graphType}:${selection.subject ?? ""}:${architectureDetailLevel}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({
      label: showInLabel(graphType),
      graphType,
      subject: selection.subject,
      architectureDetailLevel: selection.architectureDetailLevel,
      focusIdentity: identity,
    });
  }
  return targets;
}

function graphSyncTargetsByNode(
  summary: SemanticSummary,
  graph: DclGraphModel,
  currentGraphType: DclGraphWorkspaceType,
): Record<string, DclGraphWorkspaceSyncTarget[]> {
  const targets: Record<string, DclGraphWorkspaceSyncTarget[]> = {};
  for (const node of graph.nodes) {
    const nodeTargets = graphSyncTargetsForIdentity(summary, node.semanticIdentity, currentGraphType);
    if (nodeTargets.length) targets[node.id] = nodeTargets;
  }
  return targets;
}

function graphSelectionsForIdentity(
  summary: SemanticSummary,
  identity: DclSemanticIdentity,
): DclGraphWorkspaceSelection[] {
  const selections: DclGraphWorkspaceSelection[] = [];

  if (identity.kind === "context" || identity.kind === "capability") {
    selections.push({ graphType: "architecture", focusIdentity: identity });
  }
  if (identity.kind === "event") {
    selections.push({ graphType: "architecture", architectureDetailLevel: "detailed", focusIdentity: identity });
  }
  if (identity.kind === "lifecycle") {
    selections.push({ graphType: "architecture", architectureDetailLevel: "full", focusIdentity: identity });
  }

  for (const subject of capabilitySubjectsForIdentity(summary, identity)) {
    selections.push({ graphType: "capability", subject, focusIdentity: identity });
  }

  if (identity.kind === "event") {
    selections.push({ graphType: "event-flow", subject: identity.name, focusIdentity: identity });
  }

  for (const subject of lifecycleSubjectsForIdentity(summary, identity)) {
    selections.push({ graphType: "lifecycle", subject, focusIdentity: identity });
  }

  if (identity.kind === "context") {
    selections.push({ graphType: "context-map", subject: identity.name, focusIdentity: identity });
  }

  return selections;
}

function capabilitySubjectsForIdentity(summary: SemanticSummary, identity: DclSemanticIdentity): string[] {
  if (identity.kind === "capability") {
    return summary.capabilities.some((capability) => capability.name === identity.name) ? [identity.name] : [];
  }
  if (identity.kind === "lifecycle") {
    return summary.capabilities.some((capability) => capability.name === identity.name && capability.lifecycle)
      ? [identity.name]
      : [];
  }

  return summary.capabilities
    .filter((capability) => capabilityGraphCanRepresent(capability, identity))
    .map((capability) => capability.name);
}

function lifecycleSubjectsForIdentity(summary: SemanticSummary, identity: DclSemanticIdentity): string[] {
  if (identity.kind === "lifecycle") {
    return summary.capabilities.some((capability) => capability.name === identity.name && capability.lifecycle)
      ? [identity.name]
      : [];
  }
  if (identity.kind !== "lifecycle-step" && identity.kind !== "lifecycle-transition") return [];
  return summary.capabilities
    .filter((capability) => Boolean(capability.lifecycle) && lifecycleCanRepresent(capability, identity))
    .map((capability) => capability.name);
}

function capabilityGraphCanRepresent(
  capability: SemanticSummary["capabilities"][number],
  identity: DclSemanticIdentity,
): boolean {
  switch (identity.kind) {
    case "event":
      return (capability.eventDetails ?? []).some((event) => event.event === identity.name)
        || (capability.events ?? []).includes(identity.name);
    case "effect":
      return (capability.effects ?? []).some((effect) => effect.replace(/\s+after\s+.+$/i, "") === identity.name);
    case "policy":
      return (capability.policies ?? []).some((policy) => policy.replace(/\s+applies to\s+.+$/i, "") === identity.name);
    default:
      return false;
  }
}

function lifecycleCanRepresent(
  capability: SemanticSummary["capabilities"][number],
  identity: DclSemanticIdentity,
): boolean {
  if (identity.kind === "lifecycle-step") {
    return [
      capability.lifecycle?.begin,
      ...(capability.lifecycle?.steps ?? []),
      ...(capability.lifecycle?.ends ?? []),
      ...(capability.lifecycle?.stepDetails?.map((step) => step.name) ?? []),
      ...(capability.lifecycle?.transitionDetails?.flatMap((transition) => [transition.from, transition.to]) ?? []),
    ].includes(identity.name);
  }

  return (capability.lifecycle?.transitions ?? []).includes(identity.name);
}

function showInLabel(graphType: DclGraphWorkspaceType): string {
  switch (graphType) {
    case "architecture":
      return "Show in Architecture Overview";
    case "capability":
      return "Show in Capability Graph";
    case "lifecycle":
      return "Show in Lifecycle Graph";
    case "event-flow":
      return "Show in Event Flow Graph";
    case "context-map":
      return "Show in Context Map";
  }
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
      return displayContexts(summary).length
        ? [
          { label: "All contexts", value: ALL_CONTEXTS },
          ...displayContexts(summary).map((context) => ({
            label: context.name,
            value: context.name,
            description: context.parent ? `child of ${context.parent}` : undefined,
          })),
        ]
        : [];
  }
}

function displayContexts(summary: SemanticSummary) {
  return normalizeContextsForDisplay(summary.contexts, summary.capabilities) ?? [];
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
