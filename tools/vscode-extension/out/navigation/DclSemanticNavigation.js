"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSemanticNavigationItems = buildSemanticNavigationItems;
exports.semanticItemMatchesQuery = semanticItemMatchesQuery;
exports.findSemanticNavigationItem = findSemanticNavigationItem;
exports.relatedSemanticItems = relatedSemanticItems;
exports.semanticInspectorText = semanticInspectorText;
const DclSemanticIdentity_1 = require("../graphs/DclSemanticIdentity");
const DclGraphLabels_1 = require("../graphs/DclGraphLabels");
function buildSemanticNavigationItems(summary) {
    const items = [];
    for (const context of summary.contexts ?? []) {
        items.push(item("context", context.name, context.location, (0, DclSemanticIdentity_1.semanticIdentity)("context", context.name), {
            relationships: [
                ...context.children?.map((child) => `contains ${child}`) ?? [],
                ...context.dependencies?.map((dependency) => `depends on ${dependency}`) ?? [],
            ],
        }));
    }
    for (const capability of summary.capabilities) {
        items.push(item("capability", capability.name, capability.location, (0, DclSemanticIdentity_1.semanticIdentity)("capability", capability.name), {
            context: capability.context,
            relationships: capabilityRelationships(capability),
        }));
        addCapabilityChildren(items, capability);
    }
    for (const event of summary.events ?? []) {
        items.push(item("event", event.label, event.location, (0, DclSemanticIdentity_1.semanticIdentity)("event", event.label)));
    }
    for (const effect of summary.effects ?? []) {
        items.push(item("effect", effect.label, effect.location, (0, DclSemanticIdentity_1.semanticIdentity)("effect", effect.label)));
    }
    for (const policy of summary.policies ?? []) {
        items.push(item("policy", policy.label, policy.location, (0, DclSemanticIdentity_1.semanticIdentity)("policy", policy.label)));
    }
    for (const actor of summary.actors ?? []) {
        items.push(item("actor", actor.label, actor.location, undefined));
    }
    for (const lifecycle of summary.lifecycles ?? []) {
        items.push(item("lifecycle", lifecycle.label, lifecycle.location, (0, DclSemanticIdentity_1.semanticIdentity)("lifecycle", lifecycle.label)));
    }
    return dedupeItems(items);
}
function semanticItemMatchesQuery(item, query) {
    const normalized = normalizeQuery(query);
    if (!normalized)
        return true;
    return fuzzyIncludes(`${item.category} ${item.name} ${item.displayName} ${item.context ?? ""}`, normalized);
}
function findSemanticNavigationItem(items, identity) {
    if (!identity)
        return undefined;
    return items.find((item) => item.identity?.kind === identity.kind && item.identity.name === identity.name);
}
function relatedSemanticItems(summary, selected) {
    const all = buildSemanticNavigationItems(summary);
    switch (selected.kind) {
        case "capability":
            return relatedToCapability(all, summary.capabilities.find((capability) => capability.name === selected.name));
        case "event":
            return relatedToEvent(all, summary, selected.name);
        case "context":
            return relatedToContext(all, summary, selected.name);
        case "lifecycle":
            return relatedToLifecycle(all, summary.capabilities.find((capability) => capability.name === selected.name || capability.lifecycle?.begin === selected.name));
        default:
            return all.filter((item) => item.relationships.some((relationship) => relationship.includes(selected.name)));
    }
}
function semanticInspectorText(item) {
    return [
        `Symbol: ${item.name}`,
        `Display: ${item.displayName}`,
        `Type: ${item.category}`,
        item.context ? `Context: ${item.context}` : undefined,
        item.parentCapability ? `Capability: ${item.parentCapability}` : undefined,
        item.source?.file ? `Source: ${item.source.file}:${item.source.line ?? "?"}:${item.source.column ?? 1}` : "Source: not available",
        `Graph: ${item.graphAvailable ? "available" : "not available"}`,
        item.relationships.length ? `Relationships: ${item.relationships.join("; ")}` : "Relationships: none",
    ].filter(Boolean).join("\n");
}
function addCapabilityChildren(items, capability) {
    for (const event of capability.eventDetails ?? []) {
        items.push(item("event", event.event, capability.itemLocations?.events?.[event.label] ?? capability.itemLocations?.events?.[event.event], (0, DclSemanticIdentity_1.semanticIdentity)("event", event.event), {
            parentCapability: capability.name,
            context: capability.context,
            relationships: [`emitted by ${capability.name}`],
        }));
    }
    for (const effect of capability.effects ?? []) {
        const name = effect.replace(/\s+after\s+.+$/i, "");
        items.push(item("effect", name, capability.itemLocations?.effects?.[effect], (0, DclSemanticIdentity_1.semanticIdentity)("effect", name), {
            parentCapability: capability.name,
            context: capability.context,
            relationships: [`caused by ${capability.name}`],
        }));
    }
    for (const policy of capability.policies ?? []) {
        const name = policy.replace(/\s+applies to\s+.+$/i, "");
        items.push(item("policy", name, capability.itemLocations?.policies?.[policy], (0, DclSemanticIdentity_1.semanticIdentity)("policy", name), {
            parentCapability: capability.name,
            context: capability.context,
            relationships: [`governs ${capability.name}`],
        }));
    }
    if (capability.lifecycle) {
        items.push(item("lifecycle", capability.name, firstLifecycleLocation(capability), (0, DclSemanticIdentity_1.semanticIdentity)("lifecycle", capability.name), {
            parentCapability: capability.name,
            context: capability.context,
            relationships: lifecycleRelationships(capability),
        }));
        for (const step of lifecycleStepNames(capability)) {
            items.push(item("lifecycle-step", step, capability.itemLocations?.lifecycle?.[step] ?? capability.itemLocations?.lifecycle?.[`begin ${step}`] ?? capability.itemLocations?.lifecycle?.[`end ${step}`], (0, DclSemanticIdentity_1.semanticIdentity)("lifecycle-step", step), {
                parentCapability: capability.name,
                context: capability.context,
            }));
        }
        for (const transition of capability.lifecycle.transitionDetails ?? []) {
            const label = formatTransition(transition);
            items.push(item("lifecycle-transition", label, capability.itemLocations?.lifecycle?.[label], (0, DclSemanticIdentity_1.semanticIdentity)("lifecycle-transition", label), {
                parentCapability: capability.name,
                context: capability.context,
            }));
        }
    }
}
function relatedToCapability(items, capability) {
    if (!capability)
        return [];
    const names = new Set([
        ...capability.events ?? [],
        ...capability.eventDetails?.map((event) => event.event) ?? [],
        ...capability.effects?.map((effect) => effect.replace(/\s+after\s+.+$/i, "")) ?? [],
        ...capability.policies?.map((policy) => policy.replace(/\s+applies to\s+.+$/i, "")) ?? [],
        ...capability.lifecycle ? [capability.name] : [],
    ]);
    return items.filter((item) => item.parentCapability === capability.name || names.has(item.name));
}
function relatedToEvent(items, summary, eventName) {
    const capabilityNames = new Set();
    const transitionLabels = new Set();
    for (const capability of summary.capabilities) {
        if (capability.eventDetails?.some((event) => event.event === eventName) || capability.events?.some((event) => event.replace(/\s+from\s+.+$/i, "") === eventName)) {
            capabilityNames.add(capability.name);
        }
        for (const transition of capability.lifecycle?.transitionDetails ?? []) {
            if (transition.triggerKind === "event" && transition.triggerName === eventName) {
                capabilityNames.add(capability.name);
                transitionLabels.add(formatTransition(transition));
            }
        }
    }
    return items.filter((item) => capabilityNames.has(item.name) || transitionLabels.has(item.name));
}
function relatedToContext(items, summary, contextName) {
    const context = summary.contexts?.find((item) => item.name === contextName);
    const names = new Set([
        ...summary.capabilities.filter((capability) => capability.context === contextName).map((capability) => capability.name),
        ...context?.dependencies ?? [],
        ...context?.children ?? [],
    ]);
    return items.filter((item) => names.has(item.name));
}
function relatedToLifecycle(items, capability) {
    if (!capability?.lifecycle)
        return [];
    const names = new Set([
        ...lifecycleStepNames(capability),
        ...capability.lifecycle.transitionDetails?.map(formatTransition) ?? [],
    ]);
    return items.filter((item) => item.parentCapability === capability.name && names.has(item.name));
}
function item(kind, name, source, identity, options = {}) {
    const category = categoryFor(kind);
    const displayName = (0, DclGraphLabels_1.displayNameForGraph)(name);
    return {
        id: `${kind}:${name}`,
        kind,
        category,
        name,
        displayName,
        label: `${category}: ${displayName}`,
        source,
        identity,
        context: options.context,
        parentCapability: options.parentCapability,
        relationships: options.relationships ?? [],
        graphAvailable: Boolean(identity),
    };
}
function categoryFor(kind) {
    switch (kind) {
        case "lifecycle-step":
            return "Lifecycle Step";
        case "lifecycle-transition":
            return "Lifecycle Transition";
        default:
            return kind.charAt(0).toUpperCase() + kind.slice(1);
    }
}
function capabilityRelationships(capability) {
    return [
        ...capability.intents?.map((intent) => `intent ${intent}`) ?? [],
        ...capability.outcomes?.map((outcome) => `outcome ${outcome}`) ?? [],
        ...capability.policies?.map((policy) => `policy ${policy}`) ?? [],
        ...capability.effects?.map((effect) => `effect ${effect}`) ?? [],
        ...capability.events?.map((event) => `event ${event}`) ?? [],
        capability.lifecycle ? "has lifecycle" : undefined,
    ].filter((item) => Boolean(item));
}
function lifecycleRelationships(capability) {
    return [
        ...capability.lifecycle?.steps?.map((step) => `step ${step}`) ?? [],
        ...capability.lifecycle?.transitions?.map((transition) => `transition ${transition}`) ?? [],
    ];
}
function lifecycleStepNames(capability) {
    return Array.from(new Set([
        capability.lifecycle?.begin,
        ...capability.lifecycle?.ends ?? [],
        ...capability.lifecycle?.stepDetails?.map((step) => step.name) ?? [],
        ...capability.lifecycle?.transitionDetails?.flatMap((transition) => [transition.from, transition.to]) ?? [],
    ].filter((value) => Boolean(value))));
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
function dedupeItems(items) {
    return Array.from(new Map(items.map((item) => [item.id, item])).values());
}
function normalizeQuery(query) {
    return query.trim().toLowerCase();
}
function fuzzyIncludes(value, query) {
    const target = value.toLowerCase();
    let index = 0;
    for (const char of query) {
        index = target.indexOf(char, index);
        if (index === -1)
            return false;
        index += 1;
    }
    return true;
}
//# sourceMappingURL=DclSemanticNavigation.js.map