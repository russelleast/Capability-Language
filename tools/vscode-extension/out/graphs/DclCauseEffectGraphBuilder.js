"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAUSE_EFFECT_GRAPH_DESCRIPTION = void 0;
exports.buildCauseEffectGraph = buildCauseEffectGraph;
exports.buildCauseEffectGraphFromCapability = buildCauseEffectGraphFromCapability;
const DclGraphLabels_1 = require("./DclGraphLabels");
const DclSemanticIdentity_1 = require("./DclSemanticIdentity");
exports.CAUSE_EFFECT_GRAPH_DESCRIPTION = "The cause-and-effect graph shows compiler-derived causal relationships. Entry edges such as intent starts capability are shown for orientation, but outcomes, events, and lifecycle movement are only connected when causation is explicit in source/IR.";
function buildCauseEffectGraph(summary, capabilityName) {
    const capability = summary.capabilities.find((item) => item.name === capabilityName);
    if (!capability)
        return undefined;
    return buildCauseEffectGraphFromCapability(summary, capability);
}
function buildCauseEffectGraphFromCapability(summary, capability) {
    const nodes = [capabilityNode(capability)];
    const edges = [];
    const warnings = [];
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
        if (!trigger)
            continue;
        const transitionNode = lifecycleTransitionNode(capability, transition);
        nodes.push(trigger);
        nodes.push(transitionNode);
        nodes.push(lifecycleStepNode(capability, transition.to));
        edges.push(edge(trigger.id, transitionNode.id, "moves lifecycle", "moves-lifecycle"));
        edges.push(edge(transitionNode.id, lifecycleStepId(transition.to), "to", "lifecycle-target"));
        causalEdgeCount++;
    }
    if (causalEdgeCount === 0)
        return undefined;
    return {
        title: `${capability.name} Cause and Effect Graph`,
        description: exports.CAUSE_EFFECT_GRAPH_DESCRIPTION,
        warnings: dedupeStrings(warnings),
        nodes: dedupeNodes(nodes),
        edges: dedupeEdges(edges),
    };
}
function sourceNode(capability, sourceKind, sourceName) {
    if (sourceKind === "capability" && sourceName === capability.name)
        return capabilityNode(capability);
    if (!sourceName)
        return undefined;
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
function transitionTriggerNode(summary, capability, transition) {
    if (!transition.triggerKind || !transition.triggerName)
        return undefined;
    if (transition.triggerKind === "outcome")
        return outcomeNode(capability, transition.triggerName);
    if (transition.triggerKind === "event")
        return eventNode(summary, capability, transition.triggerName, transition.triggerName);
    return namedNode(transition.triggerKind, transition.triggerName);
}
function edgeLabelForCause(sourceKind, condition) {
    if (condition === "otherwise" || condition === "always")
        return condition;
    if (sourceKind === "rule" || condition === "violated")
        return "fails";
    if (sourceKind === "policy" || condition === "denied" || condition === "denies")
        return "denies";
    if (sourceKind === "effect" || condition === "unresolved" || condition === "failed")
        return "failed";
    return condition || "causes";
}
function capabilityNode(capability) {
    return {
        id: capabilityId(capability.name),
        label: (0, DclGraphLabels_1.displayNameForGraph)(capability.name),
        sourceName: capability.name,
        kind: "capability",
        source: capability.location,
        semanticIdentity: (0, DclSemanticIdentity_1.semanticIdentity)("capability", capability.name),
    };
}
function outcomeNode(capability, name) {
    return {
        id: outcomeId(name),
        label: (0, DclGraphLabels_1.displayNameForGraph)(name),
        sourceName: name,
        kind: "outcome",
        source: capability.itemLocations?.outcomes?.[name],
    };
}
function eventNode(summary, capability, event, label) {
    return {
        id: eventId(event),
        label: (0, DclGraphLabels_1.displayNameForGraph)(event),
        sourceName: label,
        kind: "event",
        source: eventLocation(summary, capability, event, label),
        semanticIdentity: (0, DclSemanticIdentity_1.semanticIdentity)("event", event),
    };
}
function lifecycleTransitionNode(capability, transition) {
    const label = `${transition.from} -> ${transition.to}`;
    const sourceName = formatTransition(transition);
    return {
        id: lifecycleTransitionId(sourceName),
        label: `${(0, DclGraphLabels_1.displayNameForGraph)(transition.from)} -> ${(0, DclGraphLabels_1.displayNameForGraph)(transition.to)}`,
        sourceName,
        kind: "lifecycle-transition",
        source: capability.itemLocations?.lifecycle?.[sourceName],
        semanticIdentity: (0, DclSemanticIdentity_1.semanticIdentity)("lifecycle-transition", sourceName),
    };
}
function lifecycleStepNode(capability, step) {
    const terminal = new Set(capability.lifecycle?.ends ?? []);
    return {
        id: lifecycleStepId(step),
        label: (0, DclGraphLabels_1.displayNameForGraph)(step),
        sourceName: step,
        kind: terminal.has(step) ? "terminal-step" : "step",
        source: capability.itemLocations?.lifecycle?.[step],
        semanticIdentity: (0, DclSemanticIdentity_1.semanticIdentity)("lifecycle-step", step),
    };
}
function namedNode(kind, name, source) {
    return {
        id: nodeId(kind, name),
        label: (0, DclGraphLabels_1.displayNameForGraph)(name),
        sourceName: name,
        kind,
        source,
        semanticIdentity: semanticIdentityForKind(kind, name),
    };
}
function semanticIdentityForKind(kind, name) {
    if (kind === "effect")
        return (0, DclSemanticIdentity_1.semanticIdentity)("effect", name);
    if (kind === "policy")
        return (0, DclSemanticIdentity_1.semanticIdentity)("policy", name);
    if (kind === "event")
        return (0, DclSemanticIdentity_1.semanticIdentity)("event", name);
    if (kind === "capability")
        return (0, DclSemanticIdentity_1.semanticIdentity)("capability", name);
    return undefined;
}
function eventLocation(summary, capability, event, label) {
    return capability.itemLocations?.events?.[label]
        ?? capability.itemLocations?.events?.[event]
        ?? summary.events?.find((item) => item.label === event)?.location;
}
function effectLocation(capability, effect) {
    const label = capability.effects?.find((item) => item === effect || item.replace(/\s+after\s+.+$/i, "") === effect);
    return label ? capability.itemLocations?.effects?.[label] : undefined;
}
function policyLocation(capability, policy) {
    const label = capability.policies?.find((item) => item === policy || item.replace(/\s+applies to\s+.+$/i, "") === policy);
    return label ? capability.itemLocations?.policies?.[label] : undefined;
}
function firstLifecycleLocation(capability) {
    const locations = capability.itemLocations?.lifecycle;
    return locations ? Object.values(locations)[0] : capability.location;
}
function formatTransition(transition) {
    const trigger = [transition.triggerKind, transition.triggerName].filter(Boolean).join(" ");
    const source = transition.sourceCapability ? ` from ${transition.sourceCapability}` : "";
    return trigger ? `${transition.from} -> ${transition.to} on ${trigger}${source}` : `${transition.from} -> ${transition.to}`;
}
function edge(source, target, label, kind) {
    return {
        id: `${source}->${target}:${kind}:${label}`,
        source,
        target,
        label,
        kind,
    };
}
function capabilityId(name) {
    return nodeId("capability", name);
}
function outcomeId(name) {
    return nodeId("outcome", name);
}
function eventId(name) {
    return nodeId("event", name);
}
function lifecycleTransitionId(name) {
    return nodeId("lifecycle-transition", name);
}
function lifecycleStepId(name) {
    return nodeId("step", name);
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
function dedupeStrings(items) {
    return Array.from(new Set(items));
}
//# sourceMappingURL=DclCauseEffectGraphBuilder.js.map