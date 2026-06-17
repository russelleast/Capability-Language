import { CapabilityItemKind, CapabilitySummary, SemanticSummary } from "../views/semanticSummary";
import { DclGraphEdge, DclGraphModel, DclGraphNode } from "./DclGraphModel";

type CapabilityListKind = Exclude<CapabilityItemKind, "lifecycle" | "actors">;

const RELATION_BY_KIND: Record<CapabilityListKind, { label: string; kind: string }> = {
  intents: { label: "accepts intent", kind: "accepts-intent" },
  outcomes: { label: "produces outcome", kind: "produces-outcome" },
  rules: { label: "enforces rule", kind: "enforces-rule" },
  effects: { label: "causes effect", kind: "causes-effect" },
  events: { label: "emits event", kind: "emits-event" },
  policies: { label: "governed by policy", kind: "governed-by-policy" },
};

export function buildCapabilityGraph(summary: SemanticSummary, capabilityName: string): DclGraphModel | undefined {
  const capability = summary.capabilities.find((item) => item.name === capabilityName);
  if (!capability) return undefined;
  return buildCapabilityGraphFromCapability(capability);
}

export function buildCapabilityGraphFromCapability(capability: CapabilitySummary): DclGraphModel {
  const capabilityId = nodeId("capability", capability.name);
  const nodes: DclGraphNode[] = [
    {
      id: capabilityId,
      label: capability.name,
      kind: "capability",
      source: capability.location,
    },
  ];
  const edges: DclGraphEdge[] = [];

  for (const kind of Object.keys(RELATION_BY_KIND) as CapabilityListKind[]) {
    for (const item of capability[kind] ?? []) {
      const id = nodeId(kind, item);
      nodes.push({
        id,
        label: item,
        kind: singularKind(kind),
        source: capability.itemLocations?.[kind]?.[item],
      });
      edges.push(edge(capabilityId, id, RELATION_BY_KIND[kind]));
    }
  }

  if (capability.lifecycle) {
    const lifecycleLabel = capability.lifecycle.begin ? `Lifecycle: ${capability.lifecycle.begin}` : "Lifecycle";
    const id = nodeId("lifecycle", capability.name);
    nodes.push({
      id,
      label: lifecycleLabel,
      kind: "lifecycle",
      source: firstLifecycleLocation(capability),
    });
    edges.push(edge(capabilityId, id, { label: "owns lifecycle", kind: "owns-lifecycle" }));
  }

  return {
    title: `${capability.name} Capability Graph`,
    nodes: dedupeNodes(nodes),
    edges: dedupeEdges(edges),
  };
}

function edge(source: string, target: string, relation: { label: string; kind: string }): DclGraphEdge {
  return {
    id: `${source}->${target}:${relation.kind}`,
    source,
    target,
    label: relation.label,
    kind: relation.kind,
  };
}

function nodeId(kind: string, label: string): string {
  return `${kind}:${slug(label)}`;
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function singularKind(kind: CapabilityListKind): string {
  switch (kind) {
    case "policies":
      return "policy";
    default:
      return kind.replace(/s$/, "");
  }
}

function firstLifecycleLocation(capability: CapabilitySummary): CapabilitySummary["location"] {
  const locations = capability.itemLocations?.lifecycle;
  return locations ? Object.values(locations)[0] : capability.location;
}

function dedupeNodes(nodes: DclGraphNode[]): DclGraphNode[] {
  return Array.from(new Map(nodes.map((node) => [node.id, node])).values());
}

function dedupeEdges(edges: DclGraphEdge[]): DclGraphEdge[] {
  return Array.from(new Map(edges.map((edge) => [edge.id, edge])).values());
}
