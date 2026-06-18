"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLifecycleGraph = buildLifecycleGraph;
exports.buildLifecycleGraphFromCapability = buildLifecycleGraphFromCapability;
const DclGraphLabels_1 = require("./DclGraphLabels");
function buildLifecycleGraph(summary, capabilityName) {
    const capability = summary.capabilities.find((item) => item.name === capabilityName);
    if (!capability?.lifecycle)
        return undefined;
    return buildLifecycleGraphFromCapability(capability);
}
function buildLifecycleGraphFromCapability(capability) {
    const lifecycleId = nodeId("lifecycle", capability.name);
    const nodes = [
        {
            id: lifecycleId,
            label: `${(0, DclGraphLabels_1.displayNameForGraph)(capability.name)} Lifecycle`,
            sourceName: `${capability.name} lifecycle`,
            kind: "lifecycle",
            source: firstLifecycleLocation(capability),
        },
    ];
    const edges = [];
    const stepNames = lifecycleStepNames(capability);
    const terminalSteps = new Set(capability.lifecycle?.ends ?? []);
    const initialStep = capability.lifecycle?.begin;
    for (const stepName of stepNames) {
        nodes.push({
            id: stepId(stepName),
            label: (0, DclGraphLabels_1.displayNameForGraph)(stepName),
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
        if (!transition.from || !transition.to)
            continue;
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
function lifecycleStepNames(capability) {
    const names = [
        capability.lifecycle?.begin,
        ...(capability.lifecycle?.stepDetails?.map((step) => step.name) ?? []),
        ...(capability.lifecycle?.ends ?? []),
        ...(capability.lifecycle?.transitionDetails?.flatMap((transition) => [transition.from, transition.to]) ?? []),
    ].filter((item) => Boolean(item));
    return Array.from(new Set(names));
}
function transitionLabel(transition) {
    const trigger = [transition.triggerKind, transition.triggerName].filter(Boolean).join(" ");
    if (!trigger)
        return "transition";
    const readableTrigger = transition.triggerName
        ? `${transition.triggerKind} ${(0, DclGraphLabels_1.displayNameForGraph)(transition.triggerName)}`
        : transition.triggerKind;
    return transition.sourceCapability
        ? `on ${readableTrigger} from ${(0, DclGraphLabels_1.displayNameForGraph)(transition.sourceCapability)}`
        : `on ${readableTrigger}`;
}
function stepKind(stepName, initialStep, terminalSteps) {
    if (stepName === initialStep)
        return "initial-step";
    if (terminalSteps.has(stepName))
        return "terminal-step";
    return "step";
}
function stepId(stepName) {
    return nodeId("step", stepName);
}
function nodeId(kind, label) {
    return `${kind}:${slug(label)}`;
}
function slug(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
function firstLifecycleLocation(capability) {
    const locations = capability.itemLocations?.lifecycle;
    return locations ? Object.values(locations)[0] : capability.location;
}
function lifecycleLocation(capability, label) {
    return capability.itemLocations?.lifecycle?.[label];
}
function dedupeNodes(nodes) {
    return Array.from(new Map(nodes.map((node) => [node.id, node])).values());
}
function dedupeEdges(edges) {
    return Array.from(new Map(edges.map((edge) => [edge.id, edge])).values());
}
//# sourceMappingURL=DclLifecycleGraphBuilder.js.map