import { CapabilitySummary, LifecycleTransitionSummary, SemanticSummary, SourceLocation } from "../views/semanticSummary";
import { displayNameForGraph } from "./DclGraphLabels";
import { DclGraphEdge, DclGraphModel, DclGraphNode } from "./DclGraphModel";
import { semanticIdentity } from "./DclSemanticIdentity";

export function buildEventFlowGraph(summary: SemanticSummary, eventName?: string): DclGraphModel | undefined {
  const events = eventNames(summary, eventName);
  if (!events.length) return undefined;
  return buildEventFlowGraphForEvents(summary, events, eventName);
}

function buildEventFlowGraphForEvents(summary: SemanticSummary, events: string[], selectedEvent?: string): DclGraphModel {
  const selected = new Set(events);
  const nodes: DclGraphNode[] = [];
  const edges: DclGraphEdge[] = [];

  for (const event of events) {
    nodes.push({
      id: eventId(event),
      label: displayNameForGraph(event),
      sourceName: event,
      kind: "event",
      source: eventLocation(summary, event),
      semanticIdentity: semanticIdentity("event", event),
    });
  }

  for (const capability of summary.capabilities) {
    for (const emission of capability.eventDetails ?? []) {
      if (!selected.has(emission.event)) continue;
      nodes.push(capabilityNode(capability));
      edges.push({
        id: `${capabilityId(capability.name)}->${eventId(emission.event)}:emits`,
        source: capabilityId(capability.name),
        target: eventId(emission.event),
        label: "emits",
        kind: "emits",
      });
    }

    for (const transition of capability.lifecycle?.transitionDetails ?? []) {
      if (transition.triggerKind !== "event" || !transition.triggerName || !selected.has(transition.triggerName)) continue;
      const transitionNode = lifecycleTransitionNode(capability, transition);
      nodes.push(capabilityNode(capability));
      nodes.push(lifecycleNode(capability));
      nodes.push(transitionNode);
      edges.push({
        id: `${eventId(transition.triggerName)}->${transitionNode.id}:triggers-transition`,
        source: eventId(transition.triggerName),
        target: transitionNode.id,
        label: "triggers transition",
        kind: "triggers-transition",
      });
      edges.push({
        id: `${eventId(transition.triggerName)}->${capabilityId(capability.name)}:references`,
        source: eventId(transition.triggerName),
        target: capabilityId(capability.name),
        label: "references",
        kind: "references",
      });
      edges.push({
        id: `${transitionNode.id}->${lifecycleId(capability.name)}:in-lifecycle`,
        source: transitionNode.id,
        target: lifecycleId(capability.name),
        label: "in lifecycle",
        kind: "in-lifecycle",
      });
    }
  }

  return {
    title: selectedEvent ? `${selectedEvent} Event Flow Graph` : "All Event Flows Graph",
    nodes: dedupeNodes(nodes),
    edges: dedupeEdges(edges),
  };
}

function eventNames(summary: SemanticSummary, eventName?: string): string[] {
  if (eventName) {
    return knownEventNames(summary).has(eventName) ? [eventName] : [];
  }
  return Array.from(knownEventNames(summary)).sort();
}

function knownEventNames(summary: SemanticSummary): Set<string> {
  const names = new Set<string>();
  for (const event of summary.events ?? []) {
    names.add(event.label);
  }
  for (const capability of summary.capabilities) {
    for (const event of capability.eventDetails ?? []) {
      names.add(event.event);
    }
    for (const transition of capability.lifecycle?.transitionDetails ?? []) {
      if (transition.triggerKind === "event" && transition.triggerName) {
        names.add(transition.triggerName);
      }
    }
  }
  return names;
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

function lifecycleNode(capability: CapabilitySummary): DclGraphNode {
  return {
    id: lifecycleId(capability.name),
    label: `${displayNameForGraph(capability.name)} Lifecycle`,
    sourceName: `${capability.name} lifecycle`,
    kind: "lifecycle",
    source: firstLifecycleLocation(capability),
    semanticIdentity: semanticIdentity("lifecycle", capability.name),
  };
}

function lifecycleTransitionNode(capability: CapabilitySummary, transition: LifecycleTransitionSummary): DclGraphNode {
  const label = `${transition.from} -> ${transition.to}`;
  return {
    id: nodeId("lifecycle-transition", `${capability.name}:${label}`),
    label: `${displayNameForGraph(transition.from)} -> ${displayNameForGraph(transition.to)}`,
    sourceName: label,
    kind: "lifecycle-transition",
    source: transitionLocation(capability, transition),
    semanticIdentity: semanticIdentity("lifecycle-transition", formatTransition(transition)),
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

function transitionLocation(capability: CapabilitySummary, transition: LifecycleTransitionSummary): SourceLocation | undefined {
  return capability.itemLocations?.lifecycle?.[formatTransition(transition)];
}

function formatTransition(transition: LifecycleTransitionSummary): string {
  const trigger = [transition.triggerKind, transition.triggerName].filter(Boolean).join(" ");
  const source = transition.sourceCapability ? ` from ${transition.sourceCapability}` : "";
  return trigger ? `${transition.from} -> ${transition.to} on ${trigger}${source}` : `${transition.from} -> ${transition.to}`;
}

function firstLifecycleLocation(capability: CapabilitySummary): SourceLocation | undefined {
  const locations = capability.itemLocations?.lifecycle;
  return locations ? Object.values(locations)[0] : capability.location;
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
