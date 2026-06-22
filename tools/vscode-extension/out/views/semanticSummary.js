"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeCompilerOutput = summarizeCompilerOutput;
exports.normalizeContextsForDisplay = normalizeContextsForDisplay;
exports.isSyntheticDefaultContext = isSyntheticDefaultContext;
exports.contextHasDeclarations = contextHasDeclarations;
const DclSourceLocation_1 = require("../source/DclSourceLocation");
function summarizeCompilerOutput(output) {
    const program = isObject(output) ? output : {};
    const effectivePolicies = Array.isArray(program.effective_policies) ? program.effective_policies.filter(isObject) : [];
    const symbolLocations = symbolLocationIndex(program.symbols);
    const symbols = Array.isArray(program.symbols) ? program.symbols.filter(isObject) : [];
    const capabilities = Array.isArray(program.capabilities) ? program.capabilities.filter(isObject) : [];
    const summarizedCapabilities = capabilities.map((capability) => summarizeCapability(capability, effectivePolicies, symbolLocations));
    return {
        capabilities: summarizedCapabilities,
        contexts: normalizeContextsForDisplay(summarizeContexts(program.contexts, symbolLocations), summarizedCapabilities, symbols),
        actors: topLevelItems(program.actors, "actor", symbolLocations),
        policies: topLevelItems(program.policies, "policy", symbolLocations),
        effects: topLevelItems(program.effects, "effect", symbolLocations),
        events: topLevelItems(program.events, "event", symbolLocations),
        lifecycles: nonEmpty(capabilities.map(formatLifecycleItem)),
    };
}
function summarizeCapability(capability, effectivePolicies, symbolLocations) {
    const name = capability.name ?? "Unnamed capability";
    const context = capability.context ?? contextFromCapabilityId(capability.id ?? capability.fully_qualified_name, name);
    const steps = nonEmpty(capability.lifecycle?.steps?.map(formatLifecycleStep));
    const transitions = nonEmpty(capability.lifecycle?.transitions?.map(formatTransition));
    const stepDetails = nonEmpty(capability.lifecycle?.steps?.map(summarizeLifecycleStep));
    const transitionDetails = nonEmpty(capability.lifecycle?.transitions?.map(summarizeLifecycleTransition));
    const eventDetails = nonEmpty([
        ...arrayItems(capability.emitted_events).map(summarizeEmittedEvent),
        ...arrayItems(capability.events).map(summarizeEventEmission),
    ]);
    const begin = capability.lifecycle?.initial_state;
    const ends = nonEmpty(capability.lifecycle?.terminal_states);
    return {
        id: capability.id ?? capability.fully_qualified_name,
        name,
        context,
        location: symbolLocation(symbolLocations, "capability", name, context),
        intents: nonEmpty(arrayItems(capability.intents).map(formatIntent)),
        actors: nonEmpty(arrayItems(capability.actors).map(formatActorRole)),
        outcomes: nonEmpty(arrayItems(capability.outcomes).map((outcome) => isObject(outcome) ? outcome.name : undefined)),
        rules: nonEmpty(arrayItems(capability.invariants).map((rule) => isObject(rule) ? rule.name : undefined)),
        effects: nonEmpty(arrayItems(capability.effects).map(formatEffectUse)),
        events: nonEmpty([
            ...arrayItems(capability.emitted_events).map((event) => isObject(event) ? event.event : undefined),
            ...arrayItems(capability.events).map(formatEventEmission),
        ]),
        eventDetails,
        policies: nonEmpty([
            ...arrayItems(capability.policies).map(formatPolicyUse),
            ...effectivePolicies.filter((policy) => policy.containing_capability === name).flatMap(formatEffectivePolicy),
        ]),
        lifecycle: begin || ends || steps || transitions || stepDetails || transitionDetails
            ? { begin, ends, steps, transitions, stepDetails, transitionDetails }
            : undefined,
        itemLocations: summarizeItemLocations(capability, effectivePolicies, symbolLocations, context),
    };
}
function summarizeItemLocations(capability, effectivePolicies, symbolLocations, context) {
    const locations = {};
    for (const intent of arrayItems(capability.intents)) {
        const label = formatIntent(intent);
        const location = intent?.input_shape ? symbolLocation(symbolLocations, "shape", intent.input_shape, context) : undefined;
        addItemLocation(locations, "intents", label, location);
    }
    for (const actor of arrayItems(capability.actors)) {
        const label = formatActorRole(actor);
        const location = actor?.actor ? symbolLocation(symbolLocations, "actor", actor.actor, context) : undefined;
        addItemLocation(locations, "actors", label, location);
    }
    for (const effect of arrayItems(capability.effects)) {
        const label = formatEffectUse(effect);
        const location = effect?.effect ? symbolLocation(symbolLocations, "effect", effect.effect, context) : undefined;
        addItemLocation(locations, "effects", label, location);
    }
    for (const event of arrayItems(capability.emitted_events)) {
        if (!isObject(event))
            continue;
        const label = event.event;
        const location = event.event ? symbolLocation(symbolLocations, "event", event.event, context) : undefined;
        addItemLocation(locations, "events", label, location);
    }
    for (const event of arrayItems(capability.events)) {
        const label = formatEventEmission(event);
        const location = event?.event ? symbolLocation(symbolLocations, "event", event.event, context) : undefined;
        addItemLocation(locations, "events", label, location);
    }
    for (const policy of arrayItems(capability.policies)) {
        const label = formatPolicyUse(policy);
        const location = policy?.policy ? symbolLocation(symbolLocations, "policy", policy.policy, context) : undefined;
        addItemLocation(locations, "policies", label, location);
    }
    for (const policy of effectivePolicies.filter((item) => item.containing_capability === capability.name)) {
        const sourceLocation = normalizedCompilerLocation(policy.source_locations?.[0]);
        for (const label of formatEffectivePolicy(policy)) {
            addItemLocation(locations, "policies", label, sourceLocation);
        }
    }
    return Object.keys(locations).length ? locations : undefined;
}
function addItemLocation(locations, kind, label, location) {
    if (!label || !location)
        return;
    locations[kind] ?? (locations[kind] = {});
    locations[kind][label] = location;
}
function summarizeContexts(contexts, symbolLocations) {
    if (!Array.isArray(contexts))
        return undefined;
    return nonEmpty(contexts.map((context) => isObject(context) ? ({
        name: context.name ?? "Unnamed context",
        parent: context.parent,
        children: nonEmpty(arrayItems(context.children)),
        dependencies: nonEmpty(arrayItems(context.dependencies)),
        location: context.name ? symbolLocation(symbolLocations, "context", context.name, context.name) : undefined,
    }) : undefined));
}
function normalizeContextsForDisplay(contexts, capabilities, symbols = []) {
    const result = (contexts ?? []).filter((context) => {
        if (!isSyntheticDefaultContext(context))
            return true;
        return contextHasDeclarations(context, capabilities, symbols);
    });
    const hasUncontextedDeclarations = capabilities.some((capability) => !capability.context);
    if (hasUncontextedDeclarations && !result.some((context) => isWorkspaceFallbackContext(context))) {
        result.push({ name: "Workspace" });
    }
    return nonEmpty(dedupeContexts(result));
}
function isSyntheticDefaultContext(context) {
    return context.name === "default" || isWorkspaceFallbackContext(context) || context.name === "Uncontexted";
}
function contextHasDeclarations(context, capabilities, symbols = []) {
    if (context.children?.length || context.dependencies?.length)
        return true;
    if (capabilities.some((capability) => capability.context === context.name))
        return true;
    return symbols.some((symbol) => symbol.kind !== "context" && symbol.context === context.name);
}
function isWorkspaceFallbackContext(context) {
    return context.name === "Workspace";
}
function dedupeContexts(contexts) {
    return Array.from(new Map(contexts.map((context) => [context.name, context])).values());
}
function topLevelItems(items, kind, symbolLocations) {
    if (!Array.isArray(items))
        return undefined;
    return nonEmpty(items.map((item) => {
        if (!isObject(item))
            return undefined;
        if (!item.name)
            return undefined;
        return { label: formatTopLevelItem(item, kind), location: symbolLocation(symbolLocations, kind, item.name, undefined) };
    }));
}
function formatTopLevelItem(item, kind) {
    const detail = kind === "actor"
        ? item.classification
        : kind === "effect"
            ? item.type
            : kind === "policy"
                ? formatPolicyDetail(item)
                : undefined;
    return detail ? `${item.name} (${detail})` : item.name ?? "";
}
function formatPolicyDetail(item) {
    if (item.kind === "confidence" && typeof item.threshold === "number") {
        return `confidence threshold ${item.threshold}`;
    }
    return item.kind;
}
function formatLifecycleItem(capability) {
    const lifecycle = capability.lifecycle;
    if (!lifecycle)
        return undefined;
    const label = lifecycle.name ?? lifecycle.id ?? capability.name;
    return label ? { label, location: undefined } : undefined;
}
function contextFromCapabilityId(id, name) {
    if (!id)
        return undefined;
    const withoutKind = id.replace(/^capability:/, "");
    if (withoutKind === name || !withoutKind.endsWith(`.${name}`))
        return undefined;
    return withoutKind.slice(0, -name.length - 1) || undefined;
}
function symbolLocationIndex(symbols) {
    const index = new Map();
    if (!Array.isArray(symbols))
        return index;
    for (const symbol of symbols) {
        if (!isObject(symbol))
            continue;
        if (!symbol.kind || !symbol.name)
            continue;
        const location = parseDeclaredLocation(symbol.declared);
        if (!location)
            continue;
        index.set(symbolKey(symbol.kind, symbol.name, symbol.context), location);
        index.set(symbolKey(symbol.kind, symbol.name, undefined), location);
    }
    return index;
}
function arrayItems(items) {
    return Array.isArray(items) ? items : [];
}
function symbolLocation(index, kind, name, context) {
    if (!name)
        return undefined;
    return index.get(symbolKey(kind, name, context)) ?? index.get(symbolKey(kind, name, undefined));
}
function symbolKey(kind, name, context) {
    return `${kind}:${context ?? ""}:${name}`;
}
function parseDeclaredLocation(declared) {
    if (!declared)
        return undefined;
    const match = /^(.*):(\d+):(\d+)$/.exec(declared);
    if (!match)
        return undefined;
    return normalizedCompilerLocation({
        file: match[1],
        line: Number(match[2]),
        column: Number(match[3]),
    });
}
function normalizedCompilerLocation(location) {
    const normalized = (0, DclSourceLocation_1.normalizeSourceLocation)(location, "oneBased");
    if (!normalized.ok)
        return undefined;
    return {
        file: normalized.location.file,
        line: normalized.location.line + 1,
        column: normalized.location.column + 1,
        indexBase: "oneBased",
    };
}
function formatIntent(intent) {
    if (!intent)
        return undefined;
    const input = intent.input_shape ?? intent.name;
    if (!input && !intent.actor)
        return undefined;
    return intent.actor ? `${input ?? "Intent"} from ${intent.actor}` : input;
}
function formatActorRole(actor) {
    if (!actor)
        return undefined;
    if (actor.role && actor.actor)
        return `${actor.role}: ${actor.actor}`;
    return actor.actor ?? actor.role;
}
function formatEffectUse(effect) {
    if (!effect?.effect)
        return undefined;
    return effect.after ? `${effect.effect} after ${effect.after}` : effect.effect;
}
function formatEventEmission(event) {
    if (!event?.event)
        return undefined;
    return event.outcome ? `${event.event} from ${event.outcome}` : event.event;
}
function formatPolicyUse(policy) {
    if (!policy?.policy)
        return undefined;
    const target = [policy.target_kind, policy.target_name].filter(Boolean).join(" ");
    return target ? `${policy.policy} applies to ${target}` : policy.policy;
}
function formatEffectivePolicy(policy) {
    const target = [policy.target_kind, policy.target_symbol].filter(Boolean).join(" ");
    return arrayItems(policy.applied_policies).map((name) => (target ? `${name} applies to ${target}` : name));
}
function formatLifecycleStep(step) {
    if (!step?.name)
        return undefined;
    const details = Array.from(new Set([step.kind, step.is_terminal ? "terminal" : undefined].filter(Boolean))).join(", ");
    return details ? `${step.name} (${details})` : step.name;
}
function formatTransition(transition) {
    if (!transition?.from || !transition.to)
        return undefined;
    const trigger = [transition.trigger_kind, transition.trigger_name].filter(Boolean).join(" ");
    const source = transition.source_capability ? ` from ${transition.source_capability}` : "";
    return trigger ? `${transition.from} -> ${transition.to} on ${trigger}${source}` : `${transition.from} -> ${transition.to}`;
}
function summarizeLifecycleStep(step) {
    if (!step?.name)
        return undefined;
    return {
        name: step.name,
        kind: step.kind,
        isTerminal: step.is_terminal,
    };
}
function summarizeLifecycleTransition(transition) {
    if (!transition?.from || !transition.to)
        return undefined;
    return {
        from: transition.from,
        to: transition.to,
        triggerKind: transition.trigger_kind,
        triggerName: transition.trigger_name,
        sourceCapability: transition.source_capability,
    };
}
function summarizeEmittedEvent(event) {
    if (!isObject(event) || !event.event)
        return undefined;
    return {
        event: event.event,
        label: event.event,
    };
}
function summarizeEventEmission(event) {
    if (!event?.event)
        return undefined;
    const label = formatEventEmission(event);
    if (!label)
        return undefined;
    return {
        event: event.event,
        label,
        sourceOutcome: event.outcome,
    };
}
function nonEmpty(items) {
    const filtered = items?.filter((item) => item !== undefined && item !== "");
    return filtered?.length ? Array.from(new Set(filtered)) : undefined;
}
function isObject(value) {
    return Boolean(value) && typeof value === "object";
}
//# sourceMappingURL=semanticSummary.js.map