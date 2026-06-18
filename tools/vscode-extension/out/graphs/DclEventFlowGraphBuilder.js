"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEventFlowGraph = buildEventFlowGraph;
function buildEventFlowGraph(summary, eventName) {
    const events = eventNames(summary, eventName);
    if (!events.length)
        return undefined;
    return buildEventFlowGraphForEvents(summary, events, eventName);
}
function buildEventFlowGraphForEvents(summary, events, selectedEvent) {
    const selected = new Set(events);
    const nodes = [];
    const edges = [];
    for (const event of events) {
        nodes.push({
            id: eventId(event),
            label: event,
            kind: "event",
            source: eventLocation(summary, event),
        });
    }
    for (const capability of summary.capabilities) {
        for (const emission of capability.eventDetails ?? []) {
            if (!selected.has(emission.event))
                continue;
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
            if (transition.triggerKind !== "event" || !transition.triggerName || !selected.has(transition.triggerName))
                continue;
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
function eventNames(summary, eventName) {
    if (eventName) {
        return knownEventNames(summary).has(eventName) ? [eventName] : [];
    }
    return Array.from(knownEventNames(summary)).sort();
}
function knownEventNames(summary) {
    const names = new Set();
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
function capabilityNode(capability) {
    return {
        id: capabilityId(capability.name),
        label: capability.name,
        kind: "capability",
        source: capability.location,
    };
}
function lifecycleNode(capability) {
    return {
        id: lifecycleId(capability.name),
        label: `${capability.name} lifecycle`,
        kind: "lifecycle",
        source: firstLifecycleLocation(capability),
    };
}
function lifecycleTransitionNode(capability, transition) {
    const label = `${transition.from} -> ${transition.to}`;
    return {
        id: nodeId("lifecycle-transition", `${capability.name}:${label}`),
        label,
        kind: "lifecycle-transition",
        source: transitionLocation(capability, transition),
    };
}
function eventLocation(summary, event) {
    return summary.events?.find((item) => item.label === event)?.location
        ?? summary.capabilities.flatMap((capability) => [
            capability.itemLocations?.events?.[event],
            ...(capability.eventDetails ?? [])
                .filter((detail) => detail.event === event)
                .map((detail) => capability.itemLocations?.events?.[detail.label]),
        ]).find(Boolean);
}
function transitionLocation(capability, transition) {
    return capability.itemLocations?.lifecycle?.[formatTransition(transition)];
}
function formatTransition(transition) {
    const trigger = [transition.triggerKind, transition.triggerName].filter(Boolean).join(" ");
    const source = transition.sourceCapability ? ` from ${transition.sourceCapability}` : "";
    return trigger ? `${transition.from} -> ${transition.to} on ${trigger}${source}` : `${transition.from} -> ${transition.to}`;
}
function firstLifecycleLocation(capability) {
    const locations = capability.itemLocations?.lifecycle;
    return locations ? Object.values(locations)[0] : capability.location;
}
function capabilityId(name) {
    return nodeId("capability", name);
}
function eventId(name) {
    return nodeId("event", name);
}
function lifecycleId(name) {
    return nodeId("lifecycle", name);
}
function nodeId(kind, label) {
    return `${kind}:${slug(label)}`;
}
function slug(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
function dedupeNodes(nodes) {
    return Array.from(new Map(nodes.map((node) => [node.id, node])).values());
}
function dedupeEdges(edges) {
    return Array.from(new Map(edges.map((edge) => [edge.id, edge])).values());
}
//# sourceMappingURL=DclEventFlowGraphBuilder.js.map