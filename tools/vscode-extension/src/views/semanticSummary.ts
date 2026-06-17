export type SemanticSummary = {
  capabilities: CapabilitySummary[];
  contexts?: ContextSummary[];
  actors?: string[];
  policies?: string[];
  effects?: string[];
  events?: string[];
  lifecycles?: string[];
};

export type ContextSummary = {
  name: string;
  dependencies?: string[];
};

export type CapabilitySummary = {
  name: string;
  context?: string;
  actors?: string[];
  outcomes?: string[];
  effects?: string[];
  events?: string[];
  policies?: string[];
  lifecycle?: {
    begin?: string;
    ends?: string[];
    steps?: string[];
    transitions?: string[];
  };
};

type ProgramOutput = {
  capabilities?: CapabilityOutput[];
  contexts?: ContextOutput[];
  actors?: NamedOutput[];
  policies?: NamedOutput[];
  effects?: NamedOutput[];
  events?: NamedOutput[];
  effective_policies?: EffectivePolicyOutput[];
};

type CapabilityOutput = {
  id?: string;
  name?: string;
  context?: string;
  actors?: ActorRoleOutput[];
  outcomes?: NamedOutput[];
  effects?: EffectUseOutput[];
  events?: EmitOutput[];
  emitted_events?: EmittedEventOutput[];
  policies?: PolicyUseOutput[];
  lifecycle?: LifecycleOutput;
};

type ContextOutput = {
  name?: string;
  dependencies?: string[];
};

type NamedOutput = {
  name?: string;
};

type ActorRoleOutput = {
  role?: string;
  actor?: string;
};

type EffectUseOutput = {
  effect?: string;
  after?: string;
};

type EmitOutput = {
  outcome?: string;
  event?: string;
};

type EmittedEventOutput = {
  event?: string;
};

type PolicyUseOutput = {
  policy?: string;
  target_kind?: string;
  target_name?: string;
};

type EffectivePolicyOutput = {
  containing_capability?: string;
  applied_policies?: string[];
  target_kind?: string;
  target_symbol?: string;
};

type LifecycleOutput = {
  id?: string;
  name?: string;
  owner_capability?: string;
  initial_state?: string;
  terminal_states?: string[];
  steps?: LifecycleStepOutput[];
  transitions?: TransitionOutput[];
};

type LifecycleStepOutput = {
  name?: string;
  kind?: string;
  is_terminal?: boolean;
};

type TransitionOutput = {
  from?: string;
  to?: string;
  trigger_kind?: string;
  trigger_name?: string;
  source_capability?: string;
};

export function summarizeCompilerOutput(output: unknown): SemanticSummary {
  const program = isObject(output) ? (output as ProgramOutput) : {};
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

function summarizeCapability(capability: CapabilityOutput, effectivePolicies: EffectivePolicyOutput[]): CapabilitySummary {
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

function formatLifecycleName(capability: CapabilityOutput): string | undefined {
  const lifecycle = capability.lifecycle;
  if (!lifecycle) return undefined;
  return lifecycle.name ?? lifecycle.id ?? capability.name;
}

function contextFromCapabilityId(id: string | undefined, name: string): string | undefined {
  if (!id) return undefined;
  const withoutKind = id.replace(/^capability:/, "");
  if (withoutKind === name || !withoutKind.endsWith(`.${name}`)) return undefined;
  return withoutKind.slice(0, -name.length - 1) || undefined;
}

function formatActorRole(actor: ActorRoleOutput | undefined): string | undefined {
  if (!actor) return undefined;
  if (actor.role && actor.actor) return `${actor.role}: ${actor.actor}`;
  return actor.actor ?? actor.role;
}

function formatEffectUse(effect: EffectUseOutput | undefined): string | undefined {
  if (!effect?.effect) return undefined;
  return effect.after ? `${effect.effect} after ${effect.after}` : effect.effect;
}

function formatEventEmission(event: EmitOutput | undefined): string | undefined {
  if (!event?.event) return undefined;
  return event.outcome ? `${event.event} from ${event.outcome}` : event.event;
}

function formatPolicyUse(policy: PolicyUseOutput | undefined): string | undefined {
  if (!policy?.policy) return undefined;
  const target = [policy.target_kind, policy.target_name].filter(Boolean).join(" ");
  return target ? `${policy.policy} applies to ${target}` : policy.policy;
}

function formatEffectivePolicy(policy: EffectivePolicyOutput): string[] {
  const target = [policy.target_kind, policy.target_symbol].filter(Boolean).join(" ");
  return (policy.applied_policies ?? []).map((name) => (target ? `${name} applies to ${target}` : name));
}

function formatLifecycleStep(step: LifecycleStepOutput | undefined): string | undefined {
  if (!step?.name) return undefined;
  const details = Array.from(new Set([step.kind, step.is_terminal ? "terminal" : undefined].filter(Boolean))).join(", ");
  return details ? `${step.name} (${details})` : step.name;
}

function formatTransition(transition: TransitionOutput | undefined): string | undefined {
  if (!transition?.from || !transition.to) return undefined;
  const trigger = [transition.trigger_kind, transition.trigger_name].filter(Boolean).join(" ");
  const source = transition.source_capability ? ` from ${transition.source_capability}` : "";
  return trigger ? `${transition.from} -> ${transition.to} on ${trigger}${source}` : `${transition.from} -> ${transition.to}`;
}

function nonEmpty<T>(items: (T | undefined)[] | undefined): T[] | undefined {
  const filtered = items?.filter((item): item is T => item !== undefined && item !== "");
  return filtered?.length ? Array.from(new Set(filtered)) : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
