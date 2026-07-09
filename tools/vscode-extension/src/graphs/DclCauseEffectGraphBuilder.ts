import { CapabilitySummary, LifecycleTransitionSummary, SemanticSummary, SourceLocation } from "../views/semanticSummary";
import { displayNameForGraph } from "./DclGraphLabels";
import { DclGraphEdge, DclGraphModel, DclGraphNode } from "./DclGraphModel";
import { semanticIdentity } from "./DclSemanticIdentity";

export const CAUSE_EFFECT_GRAPH_DESCRIPTION = "The cause-and-effect graph shows compiler-derived causal relationships. Entry edges such as intent starts capability are shown for orientation, but outcomes, events, and lifecycle movement are only connected when causation is explicit in source/IR.";

export function buildCauseEffectGraph(summary: SemanticSummary, capabilityName: string): DclGraphModel | undefined {
  const capability = summary.capabilities.find((item) => item.name === capabilityName);
  if (!capability) return undefined;
  return buildCauseEffectGraphFromCapability(summary, capability);
}

export function buildCauseEffectGraphFromCapability(summary: SemanticSummary, capability: CapabilitySummary): DclGraphModel | undefined {
  const nodes: DclGraphNode[] = [capabilityNode(capability)];
  const edges: DclGraphEdge[] = [];
  const warnings: string[] = [];
  let causalEdgeCount = 0;

  for (const intent of capability.intents ?? []) {
    nodes.push(namedNode("intent", intent, capability.itemLocations?.intents?.[intent]));
    edges.push(edge(nodeId("intent", intent), capabilityId(capability.name), "starts", "entry"));
  }

  for (const cause of capability.causation?.outcomeCauses ?? []) {
    const outcomeName = cause.outcome;
    nodes.push(outcomeNode(capability, outcomeName));

    const source = sourceNode(capability, cause.sourceKind, cause.sourceName);
    if (!source) {
      warnings.push(`Outcome '${outcomeName}' has a compiler causation source that cannot be shown: ${cause.sourceKind}${cause.sourceName ? `:${cause.sourceName}` : ""}.`);
      continue;
    }

    nodes.push(source);
    edges.push(edge(source.id, outcomeId(outcomeName), edgeLabelForCause(cause.sourceKind, cause.condition), "causes-outcome"));
    causalEdgeCount++;
  }

  for (const emission of capability.eventDetails ?? []) {
    if (!emission.sourceOutcome) {
      warnings.push(`Event '${emission.event}' is emitted by capability '${capability.name}' without an explicit outcome source, so no outcome-to-event causation edge was drawn.`);
      continue;
    }
    nodes.push(outcomeNode(capability, emission.sourceOutcome));
    nodes.push(eventNode(summary, capability, emission.event, emission.label));
    edges.push(edge(outcomeId(emission.sourceOutcome), eventId(emission.event), "emits", "emits"));
    causalEdgeCount++;
  }

  for (const transition of capability.lifecycle?.transitionDetails ?? []) {
    const trigger = transitionTriggerNode(summary, capability, transition);
    if (!trigger) continue;
    const transitionNode = lifecycleTransitionNode(capability, transition);
    nodes.push(trigger);
    nodes.push(transitionNode);
    nodes.push(lifecycleStepNode(capability, transition.to));
    edges.push(edge(trigger.id, transitionNode.id, "moves lifecycle", "moves-lifecycle"));
    edges.push(edge(transitionNode.id, lifecycleStepId(transition.to), "to", "lifecycle-target"));
    causalEdgeCount++;
  }

  if (causalEdgeCount === 0) return undefined;

  return {
    title: `${capability.name} Cause and Effect Graph`,
    description: CAUSE_EFFECT_GRAPH_DESCRIPTION,
    warnings: dedupeStrings(warnings),
    nodes: dedupeNodes(nodes),
    edges: dedupeEdges(edges),
  };
}

function sourceNode(capability: CapabilitySummary, sourceKind: string, sourceName: string | undefined): DclGraphNode | undefined {
  if (sourceKind === "capability" && sourceName === capability.name) return capabilityNode(capability);
  if (!sourceName) return undefined;

  switch (sourceKind) {
    case "rule":
      return namedNode("rule", sourceName, capability.itemLocations?.rules?.[sourceName]);
    case "policy":
      return namedNode("policy", sourceName, policyLocation(capability, sourceName));
    case "effect":
      return namedNode("effect", sourceName, effectLocation(capability, sourceName));
    case "lifecycle":
      return namedNode("lifecycle", sourceName, firstLifecycleLocation(capability));
    default:
      return namedNode(sourceKind, sourceName);
  }
}

function transitionTriggerNode(
  summary: SemanticSummary,
  capability: CapabilitySummary,
  transition: LifecycleTransitionSummary,
): DclGraphNode | undefined {
  if (!transition.triggerKind || !transition.triggerName) return undefined;
  if (transition.triggerKind === "outcome") return outcomeNode(capability, transition.triggerName);
  if (transition.triggerKind === "event") return eventNode(summary, capability, transition.triggerName, transition.triggerName);
  return namedNode(transition.triggerKind, transition.triggerName);
}

function edgeLabelForCause(sourceKind: string, condition: string | undefined): string {
  if (condition === "otherwise" || condition === "always") return condition;
  if (sourceKind === "rule" || condition === "violated") return "fails";
  if (sourceKind === "policy" || condition === "denied" || condition === "denies") return "denies";
  if (sourceKind === "effect" || condition === "unresolved" || condition === "failed") return "failed";
  return condition || "causes";
}

function capabilityNode(capability: CapabilitySummary): DclGraphNode {
  return {
    id: capabilityId(capability.name),
    label: displayNameForGraph(capability.name),
    sourceName: capability.name,
    kind: "capability",
    source: capability.location,
    semanticIdentity: semanticIdentity("capability", capability.name),
  };
}

function outcomeNode(capability: CapabilitySummary, name: string): DclGraphNode {
  return {
    id: outcomeId(name),
    label: displayNameForGraph(name),
    sourceName: name,
    kind: "outcome",
    source: capability.itemLocations?.outcomes?.[name],
  };
}

function eventNode(summary: SemanticSummary, capability: CapabilitySummary, event: string, label: string): DclGraphNode {
  return {
    id: eventId(event),
    label: displayNameForGraph(event),
    sourceName: label,
    kind: "event",
    source: eventLocation(summary, capability, event, label),
    semanticIdentity: semanticIdentity("event", event),
  };
}

function lifecycleTransitionNode(capability: CapabilitySummary, transition: LifecycleTransitionSummary): DclGraphNode {
  const label = `${transition.from} -> ${transition.to}`;
  const sourceName = formatTransition(transition);
  return {
    id: lifecycleTransitionId(sourceName),
    label: `${displayNameForGraph(transition.from)} -> ${displayNameForGraph(transition.to)}`,
    sourceName,
    kind: "lifecycle-transition",
    source: capability.itemLocations?.lifecycle?.[sourceName],
    semanticIdentity: semanticIdentity("lifecycle-transition", sourceName),
  };
}

function lifecycleStepNode(capability: CapabilitySummary, step: string): DclGraphNode {
  const terminal = new Set(capability.lifecycle?.ends ?? []);
  return {
    id: lifecycleStepId(step),
    label: displayNameForGraph(step),
    sourceName: step,
    kind: terminal.has(step) ? "terminal-step" : "step",
    source: capability.itemLocations?.lifecycle?.[step],
    semanticIdentity: semanticIdentity("lifecycle-step", step),
  };
}

function namedNode(kind: string, name: string, source?: SourceLocation): DclGraphNode {
  return {
    id: nodeId(kind, name),
    label: displayNameForGraph(name),
    sourceName: name,
    kind,
    source,
    semanticIdentity: semanticIdentityForKind(kind, name),
  };
}

function semanticIdentityForKind(kind: string, name: string) {
  if (kind === "effect") return semanticIdentity("effect", name);
  if (kind === "policy") return semanticIdentity("policy", name);
  if (kind === "event") return semanticIdentity("event", name);
  if (kind === "capability") return semanticIdentity("capability", name);
  return undefined;
}

function eventLocation(summary: SemanticSummary, capability: CapabilitySummary, event: string, label: string): SourceLocation | undefined {
  return capability.itemLocations?.events?.[label]
    ?? capability.itemLocations?.events?.[event]
    ?? summary.events?.find((item) => item.label === event)?.location;
}

function effectLocation(capability: CapabilitySummary, effect: string): SourceLocation | undefined {
  const label = capability.effects?.find((item) => item === effect || item.replace(/\s+after\s+.+$/i, "") === effect);
  return label ? capability.itemLocations?.effects?.[label] : undefined;
}

function policyLocation(capability: CapabilitySummary, policy: string): SourceLocation | undefined {
  const label = capability.policies?.find((item) => item === policy || item.replace(/\s+applies to\s+.+$/i, "") === policy);
  return label ? capability.itemLocations?.policies?.[label] : undefined;
}

function firstLifecycleLocation(capability: CapabilitySummary): SourceLocation | undefined {
  const locations = capability.itemLocations?.lifecycle;
  return locations ? Object.values(locations)[0] : capability.location;
}

function formatTransition(transition: LifecycleTransitionSummary): string {
  const trigger = [transition.triggerKind, transition.triggerName].filter(Boolean).join(" ");
  const source = transition.sourceCapability ? ` from ${transition.sourceCapability}` : "";
  return trigger ? `${transition.from} -> ${transition.to} on ${trigger}${source}` : `${transition.from} -> ${transition.to}`;
}

function edge(source: string, target: string, label: string, kind: string): DclGraphEdge {
  return {
    id: `${source}->${target}:${kind}:${label}`,
    source,
    target,
    label,
    kind,
  };
}

function capabilityId(name: string): string {
  return nodeId("capability", name);
}

function outcomeId(name: string): string {
  return nodeId("outcome", name);
}

function eventId(name: string): string {
  return nodeId("event", name);
}

function lifecycleTransitionId(name: string): string {
  return nodeId("lifecycle-transition", name);
}

function lifecycleStepId(name: string): string {
  return nodeId("step", name);
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

function dedupeStrings(items: string[]): string[] {
  return Array.from(new Set(items));
}
