"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildArchitectureOverviewGraphs = buildArchitectureOverviewGraphs;
exports.buildArchitectureOverviewGraph = buildArchitectureOverviewGraph;
const semanticSummary_1 = require("../views/semanticSummary");
const DclGraphLabels_1 = require("./DclGraphLabels");
function buildArchitectureOverviewGraphs(summary) {
    if (!summary.contexts?.length && !summary.capabilities.length)
        return undefined;
    return {
        overview: buildArchitectureOverviewGraph(summary, "overview"),
        detailed: buildArchitectureOverviewGraph(summary, "detailed"),
        full: buildArchitectureOverviewGraph(summary, "full"),
    };
}
function buildArchitectureOverviewGraph(summary, detailLevel) {
    const nodes = [];
    const edges = [];
    const contexts = (0, semanticSummary_1.normalizeContextsForDisplay)(summary.contexts, summary.capabilities) ?? [];
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
function fallbackContextName(knownContexts) {
    return knownContexts.has("default") ? "default" : "Workspace";
}
function addEventFlow(nodes, edges, summary, capability) {
    for (const event of capability.eventDetails ?? []) {
        nodes.push(eventNode(summary, event.event));
        edges.push(edge(capabilityId(capability.name), eventId(event.event), "emits", "emits"));
    }
    for (const transition of capability.lifecycle?.transitionDetails ?? []) {
        if (transition.triggerKind !== "event" || !transition.triggerName)
            continue;
        nodes.push(eventNode(summary, transition.triggerName));
        edges.push(edge(eventId(transition.triggerName), capabilityId(capability.name), "references", "references"));
    }
}
function contextNode(context, isChild) {
    return {
        id: contextId(context.name),
        label: (0, DclGraphLabels_1.displayNameForGraph)(context.name),
        sourceName: context.name,
        kind: isChild ? "child-context" : "context",
        source: context.location,
    };
}
function ensureContextNode(nodes, knownContexts, name, fallbackKind = "external-context") {
    const known = knownContexts.get(name);
    if (known) {
        nodes.push(contextNode(known, Boolean(known.parent)));
        return;
    }
    nodes.push({
        id: contextId(name),
        label: (0, DclGraphLabels_1.displayNameForGraph)(name),
        sourceName: name,
        kind: fallbackKind,
    });
}
function capabilityNode(capability) {
    return {
        id: capabilityId(capability.name),
        label: (0, DclGraphLabels_1.displayNameForGraph)(capability.name),
        sourceName: capability.name,
        kind: "capability",
        source: capability.location,
    };
}
function eventNode(summary, event) {
    return {
        id: eventId(event),
        label: (0, DclGraphLabels_1.displayNameForGraph)(event),
        sourceName: event,
        kind: "event",
        source: eventLocation(summary, event),
    };
}
function lifecycleNode(capability) {
    return {
        id: lifecycleId(capability.name),
        label: `${(0, DclGraphLabels_1.displayNameForGraph)(capability.name)} Lifecycle`,
        sourceName: `${capability.name} lifecycle`,
        kind: "lifecycle",
        source: firstLifecycleLocation(capability),
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
function firstLifecycleLocation(capability) {
    const locations = capability.itemLocations?.lifecycle;
    return locations ? Object.values(locations)[0] : capability.location;
}
function edge(source, target, label, kind) {
    return {
        id: `${source}->${target}:${kind}`,
        source,
        target,
        label,
        kind,
    };
}
function titleFor(detailLevel) {
    switch (detailLevel) {
        case "detailed":
            return "DCL Architecture Overview - Detailed";
        case "full":
            return "DCL Architecture Overview - Full";
        default:
            return "DCL Architecture Overview";
    }
}
function contextId(name) {
    return nodeId("context", name);
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
//# sourceMappingURL=DclArchitectureOverviewGraphBuilder.js.map