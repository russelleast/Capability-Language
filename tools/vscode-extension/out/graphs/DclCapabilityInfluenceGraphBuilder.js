"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAPABILITY_INFLUENCE_GRAPH_DESCRIPTION = void 0;
exports.buildCapabilityInfluenceGraph = buildCapabilityInfluenceGraph;
const DclGraphLabels_1 = require("./DclGraphLabels");
const DclSemanticIdentity_1 = require("./DclSemanticIdentity");
exports.CAPABILITY_INFLUENCE_GRAPH_DESCRIPTION = "The Capability Influence Graph shows explicit compiler-derived semantic influence between capabilities. It does not show all dependencies, shared ownership, similarity, or implementation coupling.";
const SCORE_BY_KIND = {
    lifecycle: 5,
    event: 4,
    relation: 3,
    effect: 3,
    participation: 2,
    policy: 2,
    "context reference": 1,
};
function buildCapabilityInfluenceGraph(summary) {
    if (summary.capabilities.length < 2)
        return undefined;
    const resolver = capabilityResolver(summary.capabilities);
    const nodes = summary.capabilities.map(capabilityNode);
    const influences = [];
    const warnings = [];
    collectLifecycleInfluence(summary.capabilities, resolver, influences);
    collectEventInfluence(summary.capabilities, resolver, influences, warnings);
    collectRelationInfluence(summary.capabilities, resolver, influences);
    collectEffectInfluence(summary.capabilities, resolver, influences);
    collectParticipationInfluence(summary.capabilities, resolver, influences);
    collectPolicyInfluence(summary.capabilities, resolver, influences);
    collectContextReferenceInfluence(summary, resolver, influences, warnings);
    const edges = aggregateInfluences(influences);
    if (!edges.length)
        return undefined;
    return {
        title: "DCL Capability Influence Graph",
        description: exports.CAPABILITY_INFLUENCE_GRAPH_DESCRIPTION,
        warnings: dedupeStrings(warnings),
        nodes,
        edges,
    };
}
function collectLifecycleInfluence(capabilities, resolve, influences) {
    for (const target of capabilities) {
        for (const transition of target.lifecycle?.transitionDetails ?? []) {
            const source = resolve(transition.sourceCapability);
            if (!source || source.name === target.name)
                continue;
            influences.push({
                source: source.name,
                target: target.name,
                kind: "lifecycle",
                detail: `Lifecycle transition ${transition.from} -> ${transition.to} is triggered by ${transition.triggerKind ?? "source"} ${transition.triggerName ?? "transition"} from ${source.name}.`,
            });
        }
    }
}
function collectEventInfluence(capabilities, resolve, influences, warnings) {
    const consumersByEvent = new Map();
    for (const capability of capabilities) {
        for (const transition of capability.lifecycle?.transitionDetails ?? []) {
            if (transition.triggerKind !== "event" || !transition.triggerName)
                continue;
            const list = consumersByEvent.get(transition.triggerName) ?? [];
            list.push(capability);
            consumersByEvent.set(transition.triggerName, list);
        }
    }
    for (const emitter of capabilities) {
        for (const emission of emitter.eventDetails ?? []) {
            const consumers = consumersByEvent.get(emission.event) ?? [];
            if (!consumers.length) {
                warnings.push(`Event '${emission.event}' is emitted by capability '${emitter.name}' but no compiler-derived consuming or triggered capability is known, so no influence edge was drawn.`);
                continue;
            }
            for (const consumer of consumers) {
                const target = resolve(consumer.name);
                if (!target || target.name === emitter.name)
                    continue;
                influences.push({
                    source: emitter.name,
                    target: target.name,
                    kind: "event",
                    detail: `Event '${emission.event}' emitted by '${emitter.name}' triggers a lifecycle transition in '${target.name}'.`,
                });
            }
        }
    }
}
function collectRelationInfluence(capabilities, resolve, influences) {
    for (const capability of capabilities) {
        for (const relation of capability.relations ?? []) {
            const source = resolve(relation.from);
            const target = resolve(relation.to);
            if (!source || !target || source.name === target.name)
                continue;
            influences.push({
                source: source.name,
                target: target.name,
                kind: "relation",
                detail: `Explicit capability relation '${relation.kind}'${relation.condition ? ` (${relation.condition})` : ""} connects ${source.name} to ${target.name}.`,
            });
        }
    }
}
function collectEffectInfluence(capabilities, resolve, influences) {
    for (const source of capabilities) {
        for (const effect of source.effectDetails ?? []) {
            if (effect.targetKind !== "capability")
                continue;
            const target = resolve(effect.targetName);
            if (!target || target.name === source.name)
                continue;
            influences.push({
                source: source.name,
                target: target.name,
                kind: "effect",
                detail: `Effect '${effect.effect}' in '${source.name}' explicitly targets capability '${target.name}'.`,
            });
        }
    }
}
function collectParticipationInfluence(capabilities, resolve, influences) {
    for (const owner of capabilities) {
        const participants = [
            ...(owner.lifecycle?.participatingCapabilities ?? []),
            ...(owner.lifecycle?.contributors?.map((contributor) => contributor.capability) ?? []),
        ];
        for (const participantName of participants) {
            const participant = resolve(participantName);
            if (!participant || participant.name === owner.name)
                continue;
            influences.push({
                source: participant.name,
                target: owner.name,
                kind: "participation",
                detail: `Capability '${participant.name}' explicitly participates in lifecycle owned by '${owner.name}'.`,
            });
        }
    }
}
function collectPolicyInfluence(capabilities, resolve, influences) {
    for (const source of capabilities) {
        for (const policy of source.policyDetails ?? []) {
            if (policy.targetKind !== "capability")
                continue;
            const target = resolve(policy.targetName);
            if (!target || target.name === source.name)
                continue;
            influences.push({
                source: source.name,
                target: target.name,
                kind: "policy",
                detail: `Policy '${policy.policy}' in '${source.name}' explicitly targets capability '${target.name}'.`,
            });
        }
    }
}
function collectContextReferenceInfluence(summary, resolve, influences, warnings) {
    for (const dependency of summary.dependencies ?? []) {
        const sourceCapabilities = summary.capabilities.filter((capability) => capability.context === dependency.sourceContext);
        if (sourceCapabilities.length !== 1) {
            if (dependency.referencedSymbols?.some((symbol) => resolve(symbol))) {
                warnings.push(`Context dependency '${dependency.sourceContext}' -> '${dependency.targetContext}' references a capability but no single source capability is known, so no influence edge was drawn.`);
            }
            continue;
        }
        const source = sourceCapabilities[0];
        for (const symbol of dependency.referencedSymbols ?? []) {
            const target = resolve(symbol);
            if (!target || target.name === source.name)
                continue;
            influences.push({
                source: source.name,
                target: target.name,
                kind: "context reference",
                detail: `Context dependency '${dependency.sourceContext}' -> '${dependency.targetContext}' explicitly references capability '${target.name}'.`,
            });
        }
    }
}
function aggregateInfluences(influences) {
    const grouped = new Map();
    for (const influence of influences) {
        const key = `${influence.source}->${influence.target}`;
        const list = grouped.get(key) ?? [];
        list.push(influence);
        grouped.set(key, list);
    }
    return Array.from(grouped.values()).map((items) => {
        const source = items[0].source;
        const target = items[0].target;
        const reasons = items.map(reasonForInfluence).sort((a, b) => (b.score - a.score
            || a.kind.localeCompare(b.kind)
            || a.detail.localeCompare(b.detail)));
        const label = reasons[0].label;
        const score = reasons.reduce((sum, reason) => sum + reason.score, 0);
        return {
            id: `${capabilityId(source)}->${capabilityId(target)}:influence`,
            source: capabilityId(source),
            target: capabilityId(target),
            label,
            kind: "capability-influence",
            score,
            reasons,
        };
    }).sort((a, b) => a.id.localeCompare(b.id));
}
function reasonForInfluence(influence) {
    return {
        kind: influence.kind,
        label: influence.kind,
        score: SCORE_BY_KIND[influence.kind],
        detail: influence.detail,
    };
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
function capabilityResolver(capabilities) {
    const byName = new Map();
    const byId = new Map();
    const byQualifiedName = new Map();
    for (const capability of capabilities) {
        byName.set(capability.name, capability);
        if (capability.id)
            byId.set(capability.id, capability);
        if (capability.context)
            byQualifiedName.set(`${capability.context}.${capability.name}`, capability);
    }
    return (value) => {
        if (!value)
            return undefined;
        const normalized = value.replace(/^capability:/, "");
        return byName.get(normalized)
            ?? byId.get(normalized)
            ?? byId.get(value)
            ?? byQualifiedName.get(normalized)
            ?? byQualifiedName.get(value);
    };
}
function capabilityId(name) {
    return `capability:${slug(name)}`;
}
function slug(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
function dedupeStrings(items) {
    return Array.from(new Set(items));
}
//# sourceMappingURL=DclCapabilityInfluenceGraphBuilder.js.map