"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCapabilityGraph = buildCapabilityGraph;
exports.buildCapabilityGraphFromCapability = buildCapabilityGraphFromCapability;
const RELATION_BY_KIND = {
    intents: { label: "accepts", kind: "accepts-intent" },
    outcomes: { label: "produces", kind: "produces-outcome" },
    rules: { label: "enforces", kind: "enforces-rule" },
    effects: { label: "causes", kind: "causes-effect" },
    events: { label: "emits", kind: "emits-event" },
    policies: { label: "governed by", kind: "governed-by-policy" },
};
function buildCapabilityGraph(summary, capabilityName) {
    const capability = summary.capabilities.find((item) => item.name === capabilityName);
    if (!capability)
        return undefined;
    return buildCapabilityGraphFromCapability(capability);
}
function buildCapabilityGraphFromCapability(capability) {
    const capabilityId = nodeId("capability", capability.name);
    const nodes = [
        {
            id: capabilityId,
            label: capability.name,
            kind: "capability",
            source: capability.location,
        },
    ];
    const edges = [];
    for (const kind of Object.keys(RELATION_BY_KIND)) {
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
        edges.push(edge(capabilityId, id, { label: "owns", kind: "owns-lifecycle" }));
    }
    return {
        title: `${capability.name} Capability Graph`,
        nodes: dedupeNodes(nodes),
        edges: dedupeEdges(edges),
    };
}
function edge(source, target, relation) {
    return {
        id: `${source}->${target}:${relation.kind}`,
        source,
        target,
        label: relation.label,
        kind: relation.kind,
    };
}
function nodeId(kind, label) {
    return `${kind}:${slug(label)}`;
}
function slug(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
function singularKind(kind) {
    switch (kind) {
        case "policies":
            return "policy";
        default:
            return kind.replace(/s$/, "");
    }
}
function firstLifecycleLocation(capability) {
    const locations = capability.itemLocations?.lifecycle;
    return locations ? Object.values(locations)[0] : capability.location;
}
function dedupeNodes(nodes) {
    return Array.from(new Map(nodes.map((node) => [node.id, node])).values());
}
function dedupeEdges(edges) {
    return Array.from(new Map(edges.map((edge) => [edge.id, edge])).values());
}
//# sourceMappingURL=DclCapabilityGraphBuilder.js.map