import { CapabilitySummary, LifecycleTransitionSummary, SemanticSummary } from "../views/semanticSummary";
import { displayNameForGraph } from "./DclGraphLabels";
import { DclGraphEdge, DclGraphModel, DclGraphNode } from "./DclGraphModel";
import { semanticIdentity } from "./DclSemanticIdentity";

export function buildLifecycleGraph(summary: SemanticSummary, capabilityName: string): DclGraphModel | undefined {
  const capability = summary.capabilities.find((item) => item.name === capabilityName);
  if (!capability?.lifecycle) return undefined;
  return buildLifecycleGraphFromCapability(capability);
}

export function buildLifecycleGraphFromCapability(capability: CapabilitySummary): DclGraphModel {
  const lifecycleId = nodeId("lifecycle", capability.name);
  const nodes: DclGraphNode[] = [
    {
      id: lifecycleId,
      label: `${displayNameForGraph(capability.name)} Lifecycle`,
      sourceName: `${capability.name} lifecycle`,
      kind: "lifecycle",
      source: firstLifecycleLocation(capability),
      semanticIdentity: semanticIdentity("lifecycle", capability.name),
    },
  ];
  const edges: DclGraphEdge[] = [];
  const stepNames = lifecycleStepNames(capability);
  const terminalSteps = new Set(capability.lifecycle?.ends ?? []);
  const initialStep = capability.lifecycle?.begin;

  for (const stepName of stepNames) {
    nodes.push({
      id: stepId(stepName),
      label: displayNameForGraph(stepName),
      sourceName: stepName,
      kind: stepKind(stepName, initialStep, terminalSteps),
      source: lifecycleLocation(capability, stepName),
    });
  }

  if (initialStep && stepNames.includes(initialStep)) {
    edges.push({
      id: `${lifecycleId}->${stepId(initialStep)}:begins`,
      source: lifecycleId,
      target: stepId(initialStep),
      label: "begins",
      kind: "begins",
    });
  }

  for (const transition of capability.lifecycle?.transitionDetails ?? []) {
    if (!transition.from || !transition.to) continue;
    edges.push({
      id: `${stepId(transition.from)}->${stepId(transition.to)}:${transitionLabel(transition)}`,
      source: stepId(transition.from),
      target: stepId(transition.to),
      label: transitionLabel(transition),
      kind: "transition",
    });
  }

  return {
    title: `${capability.name} Lifecycle Graph`,
    nodes: dedupeNodes(nodes),
    edges: dedupeEdges(edges),
  };
}

function lifecycleStepNames(capability: CapabilitySummary): string[] {
  const names = [
    capability.lifecycle?.begin,
    ...(capability.lifecycle?.stepDetails?.map((step) => step.name) ?? []),
    ...(capability.lifecycle?.ends ?? []),
    ...(capability.lifecycle?.transitionDetails?.flatMap((transition) => [transition.from, transition.to]) ?? []),
  ].filter((item): item is string => Boolean(item));

  return Array.from(new Set(names));
}

function transitionLabel(transition: LifecycleTransitionSummary): string {
  const trigger = [transition.triggerKind, transition.triggerName].filter(Boolean).join(" ");
  if (!trigger) return "transition";
  const readableTrigger = transition.triggerName
    ? `${transition.triggerKind} ${displayNameForGraph(transition.triggerName)}`
    : transition.triggerKind;
  return transition.sourceCapability
    ? `on ${readableTrigger} from ${displayNameForGraph(transition.sourceCapability)}`
    : `on ${readableTrigger}`;
}

function stepKind(stepName: string, initialStep: string | undefined, terminalSteps: Set<string>): string {
  if (stepName === initialStep) return "initial-step";
  if (terminalSteps.has(stepName)) return "terminal-step";
  return "step";
}

function stepId(stepName: string): string {
  return nodeId("step", stepName);
}

function nodeId(kind: string, label: string): string {
  return `${kind}:${slug(label)}`;
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function firstLifecycleLocation(capability: CapabilitySummary): CapabilitySummary["location"] {
  const locations = capability.itemLocations?.lifecycle;
  return locations ? Object.values(locations)[0] : capability.location;
}

function lifecycleLocation(capability: CapabilitySummary, label: string): CapabilitySummary["location"] {
  return capability.itemLocations?.lifecycle?.[label];
}

function dedupeNodes(nodes: DclGraphNode[]): DclGraphNode[] {
  return Array.from(new Map(nodes.map((node) => [node.id, node])).values());
}

function dedupeEdges(edges: DclGraphEdge[]): DclGraphEdge[] {
  return Array.from(new Map(edges.map((edge) => [edge.id, edge])).values());
}
