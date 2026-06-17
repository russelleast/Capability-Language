"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeCompilerOutput = summarizeCompilerOutput;
function summarizeCompilerOutput(output) {
    const program = isObject(output) ? output : {};
    const effectivePolicies = Array.isArray(program.effective_policies) ? program.effective_policies : [];
    return {
        capabilities: Array.isArray(program.capabilities)
            ? program.capabilities.map((capability) => summarizeCapability(capability, effectivePolicies))
            : [],
        contexts: nonEmpty(program.contexts?.map((context) => ({
            name: context.name ?? "Unnamed context",
            dependencies: nonEmpty(context.dependencies),
        }))),
        actors: nonEmpty(program.actors?.map((actor) => actor.name)),
        policies: nonEmpty(program.policies?.map((policy) => policy.name)),
        effects: nonEmpty(program.effects?.map((effect) => effect.name)),
        events: nonEmpty(program.events?.map((event) => event.name)),
        lifecycles: nonEmpty(program.capabilities?.map(formatLifecycleName)),
    };
}
function summarizeCapability(capability, effectivePolicies) {
    const name = capability.name ?? "Unnamed capability";
    const steps = nonEmpty(capability.lifecycle?.steps?.map(formatLifecycleStep));
    const transitions = nonEmpty(capability.lifecycle?.transitions?.map(formatTransition));
    const begin = capability.lifecycle?.initial_state;
    const ends = nonEmpty(capability.lifecycle?.terminal_states);
    return {
        name,
        context: capability.context ?? contextFromCapabilityId(capability.id, name),
        actors: nonEmpty(capability.actors?.map(formatActorRole)),
        outcomes: nonEmpty(capability.outcomes?.map((outcome) => outcome.name)),
        effects: nonEmpty(capability.effects?.map(formatEffectUse)),
        events: nonEmpty([
            ...(capability.emitted_events?.map((event) => event.event) ?? []),
            ...(capability.events?.map(formatEventEmission) ?? []),
        ]),
        policies: nonEmpty([
            ...(capability.policies?.map(formatPolicyUse) ?? []),
            ...effectivePolicies.filter((policy) => policy.containing_capability === name).flatMap(formatEffectivePolicy),
        ]),
        lifecycle: begin || ends || steps || transitions ? { begin, ends, steps, transitions } : undefined,
    };
}
function formatLifecycleName(capability) {
    const lifecycle = capability.lifecycle;
    if (!lifecycle)
        return undefined;
    return lifecycle.name ?? lifecycle.id ?? capability.name;
}
function contextFromCapabilityId(id, name) {
    if (!id)
        return undefined;
    const withoutKind = id.replace(/^capability:/, "");
    if (withoutKind === name || !withoutKind.endsWith(`.${name}`))
        return undefined;
    return withoutKind.slice(0, -name.length - 1) || undefined;
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
    return (policy.applied_policies ?? []).map((name) => (target ? `${name} applies to ${target}` : name));
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
function nonEmpty(items) {
    const filtered = items?.filter((item) => item !== undefined && item !== "");
    return filtered?.length ? Array.from(new Set(filtered)) : undefined;
}
function isObject(value) {
    return Boolean(value) && typeof value === "object";
}
//# sourceMappingURL=semanticSummary.js.map