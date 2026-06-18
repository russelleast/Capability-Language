import { CapabilitySummary, ContextSummary, SemanticSummary, SourceLocation } from "../views/semanticSummary";
import { displayNameForGraph } from "./DclGraphLabels";
import { DclGraphEdge, DclGraphModel, DclGraphNode } from "./DclGraphModel";

export type ArchitectureOverviewDetailLevel = "overview" | "detailed" | "full";

export type ArchitectureOverviewGraphSet = Record<ArchitectureOverviewDetailLevel, DclGraphModel>;

export function buildArchitectureOverviewGraphs(summary: SemanticSummary): ArchitectureOverviewGraphSet | undefined {
  if (!summary.contexts?.length && !summary.capabilities.length) return undefined;
  return {
    overview: buildArchitectureOverviewGraph(summary, "overview"),
    detailed: buildArchitectureOverviewGraph(summary, "detailed"),
    full: buildArchitectureOverviewGraph(summary, "full"),
  };
}

export function buildArchitectureOverviewGraph(
  summary: SemanticSummary,
  detailLevel: ArchitectureOverviewDetailLevel,
): DclGraphModel {
  const nodes: DclGraphNode[] = [];
  const edges: DclGraphEdge[] = [];
  const contexts = summary.contexts ?? [];
  const knownContexts = new Map(contexts.map((context) => [context.name, context]));

  for (const context of contexts) {
    nodes.push(contextNode(context, Boolean(context.parent)));
  }

  for (const context of contexts) {
    if (context.parent) {
      ensureContextNode(nodes, knownContexts, context.parent);
      edges.push(edge(contextId(context.parent), contextId(context.name), "contains", "contains-context"));
    }
    for (const child of context.children ?? []) {
      ensureContextNode(nodes, knownContexts, child);
      edges.push(edge(contextId(context.name), contextId(child), "contains", "contains-context"));
    }
  }

  for (const capability of summary.capabilities) {
    nodes.push(capabilityNode(capability));
    const parentContext = capability.context ?? fallbackContextName(knownContexts);
    ensureContextNode(nodes, knownContexts, parentContext, capability.context ? "external-context" : "context");
    edges.push(edge(contextId(parentContext), capabilityId(capability.name), "contains", "contains-capability"));

    if (detailLevel !== "overview") {
      addEventFlow(nodes, edges, summary, capability);
    }

    if (detailLevel === "full" && capability.lifecycle) {
      const lifecycle = lifecycleNode(capability);
      nodes.push(lifecycle);
      edges.push(edge(capabilityId(capability.name), lifecycle.id, "has lifecycle", "has-lifecycle"));
    }
  }

  return {
    title: titleFor(detailLevel),
    nodes: dedupeNodes(nodes),
    edges: dedupeEdges(edges),
  };
}

function fallbackContextName(knownContexts: Map<string, ContextSummary>): string {
  return knownContexts.has("default") ? "default" : "Workspace";
}

function addEventFlow(
  nodes: DclGraphNode[],
  edges: DclGraphEdge[],
  summary: SemanticSummary,
  capability: CapabilitySummary,
): void {
  for (const event of capability.eventDetails ?? []) {
    nodes.push(eventNode(summary, event.event));
    edges.push(edge(capabilityId(capability.name), eventId(event.event), "emits", "emits"));
  }

  for (const transition of capability.lifecycle?.transitionDetails ?? []) {
    if (transition.triggerKind !== "event" || !transition.triggerName) continue;
    nodes.push(eventNode(summary, transition.triggerName));
    edges.push(edge(eventId(transition.triggerName), capabilityId(capability.name), "references", "references"));
  }
}

function contextNode(context: ContextSummary, isChild: boolean): DclGraphNode {
  return {
    id: contextId(context.name),
    label: displayNameForGraph(context.name),
    sourceName: context.name,
    kind: isChild ? "child-context" : "context",
    source: context.location,
  };
}

function ensureContextNode(
  nodes: DclGraphNode[],
  knownContexts: Map<string, ContextSummary>,
  name: string,
  fallbackKind: "context" | "external-context" = "external-context",
): void {
  const known = knownContexts.get(name);
  if (known) {
    nodes.push(contextNode(known, Boolean(known.parent)));
    return;
  }

  nodes.push({
    id: contextId(name),
    label: displayNameForGraph(name),
    sourceName: name,
    kind: fallbackKind,
  });
}

function capabilityNode(capability: CapabilitySummary): DclGraphNode {
  return {
    id: capabilityId(capability.name),
    label: displayNameForGraph(capability.name),
    sourceName: capability.name,
    kind: "capability",
    source: capability.location,
  };
}

function eventNode(summary: SemanticSummary, event: string): DclGraphNode {
  return {
    id: eventId(event),
    label: displayNameForGraph(event),
    sourceName: event,
    kind: "event",
    source: eventLocation(summary, event),
  };
}

function lifecycleNode(capability: CapabilitySummary): DclGraphNode {
  return {
    id: lifecycleId(capability.name),
    label: `${displayNameForGraph(capability.name)} Lifecycle`,
    sourceName: `${capability.name} lifecycle`,
    kind: "lifecycle",
    source: firstLifecycleLocation(capability),
  };
}

function eventLocation(summary: SemanticSummary, event: string): SourceLocation | undefined {
  return summary.events?.find((item) => item.label === event)?.location
    ?? summary.capabilities.flatMap((capability) => [
      capability.itemLocations?.events?.[event],
      ...(capability.eventDetails ?? [])
        .filter((detail) => detail.event === event)
        .map((detail) => capability.itemLocations?.events?.[detail.label]),
    ]).find(Boolean);
}

function firstLifecycleLocation(capability: CapabilitySummary): SourceLocation | undefined {
  const locations = capability.itemLocations?.lifecycle;
  return locations ? Object.values(locations)[0] : capability.location;
}

function edge(source: string, target: string, label: string, kind: string): DclGraphEdge {
  return {
    id: `${source}->${target}:${kind}`,
    source,
    target,
    label,
    kind,
  };
}

function titleFor(detailLevel: ArchitectureOverviewDetailLevel): string {
  switch (detailLevel) {
    case "detailed":
      return "DCL Architecture Overview - Detailed";
    case "full":
      return "DCL Architecture Overview - Full";
    default:
      return "DCL Architecture Overview";
  }
}

function contextId(name: string): string {
  return nodeId("context", name);
}

function capabilityId(name: string): string {
  return nodeId("capability", name);
}

function eventId(name: string): string {
  return nodeId("event", name);
}

function lifecycleId(name: string): string {
  return nodeId("lifecycle", name);
}

function nodeId(kind: string, label: string): string {
  return `${kind}:${slug(label)}`;
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function dedupeNodes(nodes: DclGraphNode[]): DclGraphNode[] {
  return Array.from(new Map(nodes.map((node) => [node.id, node])).values());
}

function dedupeEdges(edges: DclGraphEdge[]): DclGraphEdge[] {
  return Array.from(new Map(edges.map((edge) => [edge.id, edge])).values());
}
