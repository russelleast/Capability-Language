export type SemanticSummary = {
  capabilities: CapabilitySummary[];
  contexts?: ContextSummary[];
  dependencies?: string[];
};

export type ContextSummary = {
  name: string;
  dependencies?: string[];
};

export type CapabilitySummary = {
  id?: string;
  name: string;
  context?: string;
  intents?: string[];
  actors?: string[];
  outcomes?: string[];
  rules?: string[];
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
  dependencies?: DependencyOutput[];
  effective_policies?: EffectivePolicyOutput[];
};

type CapabilityOutput = {
  id?: string;
  name?: string;
  context?: string;
  fully_qualified_name?: string;
  intents?: IntentOutput[];
  actors?: ActorRoleOutput[];
  outcomes?: NamedOutput[];
  invariants?: NamedOutput[];
  effects?: EffectUseOutput[];
  events?: EmitOutput[];
  emitted_events?: EmittedEventOutput[];
  policies?: PolicyUseOutput[];
  lifecycle?: LifecycleOutput;
};

type IntentOutput = {
  name?: string;
  input_shape?: string;
  actor?: string;
};

type ActorRoleOutput = {
  role?: string;
  actor?: string;
};

type NamedOutput = {
  name?: string;
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

type LifecycleOutput = {
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

type ContextOutput = {
  name?: string;
  dependencies?: string[];
};

type DependencyOutput = {
  source_context?: string;
  target_context?: string;
  referenced_symbols?: string[];
};

type EffectivePolicyOutput = {
  containing_capability?: string;
  applied_policies?: string[];
  target_kind?: string;
  target_symbol?: string;
};

export function summarizeCompilerOutput(output: unknown): SemanticSummary {
  const program = isObject(output) ? (output as ProgramOutput) : {};
  const effectivePolicies = Array.isArray(program.effective_policies) ? program.effective_policies : [];

  return {
    capabilities: Array.isArray(program.capabilities)
      ? program.capabilities.map((capability) => summarizeCapability(capability, effectivePolicies))
      : [],
    contexts: summarizeContexts(program.contexts),
    dependencies: summarizeDependencies(program.dependencies),
  };
}

function summarizeCapability(capability: CapabilityOutput, effectivePolicies: EffectivePolicyOutput[]): CapabilitySummary {
  const name = capability.name ?? "Unnamed capability";
  const summary: CapabilitySummary = {
    id: capability.id ?? capability.fully_qualified_name,
    name,
    context: capability.context ?? contextFromCapabilityId(capability.id ?? capability.fully_qualified_name, name),
  };

  summary.intents = nonEmpty(capability.intents?.map(formatIntent));
  summary.actors = nonEmpty(capability.actors?.map(formatActorRole));
  summary.outcomes = nonEmpty(capability.outcomes?.map((outcome) => outcome.name));
  summary.rules = nonEmpty(capability.invariants?.map((rule) => rule.name));
  summary.effects = nonEmpty(capability.effects?.map(formatEffectUse));
  summary.events = nonEmpty([
    ...(capability.emitted_events?.map((event) => event.event) ?? []),
    ...(capability.events?.map(formatEventEmission) ?? []),
  ]);
  summary.policies = nonEmpty([
    ...(capability.policies?.map(formatPolicyUse) ?? []),
    ...effectivePolicies.filter((policy) => policy.containing_capability === name).flatMap(formatEffectivePolicy),
  ]);

  const steps = nonEmpty(capability.lifecycle?.steps?.map(formatLifecycleStep));
  const transitions = nonEmpty(capability.lifecycle?.transitions?.map(formatTransition));
  const begin = capability.lifecycle?.initial_state;
  const ends = nonEmpty(capability.lifecycle?.terminal_states);
  if (begin || ends || steps || transitions) {
    summary.lifecycle = { begin, ends, steps, transitions };
  }

  return summary;
}

function contextFromCapabilityId(id: string | undefined, name: string): string | undefined {
  if (!id) return undefined;
  const withoutKind = id.replace(/^capability:/, "");
  if (withoutKind === name || !withoutKind.endsWith(`.${name}`)) return undefined;
  return withoutKind.slice(0, -name.length - 1) || undefined;
}

function summarizeContexts(contexts: ContextOutput[] | undefined): ContextSummary[] | undefined {
  if (!Array.isArray(contexts)) return undefined;

  return nonEmpty(
    contexts.map((context) => ({
      name: context.name ?? "Unnamed context",
      dependencies: nonEmpty(context.dependencies),
    })),
  );
}

function summarizeDependencies(dependencies: DependencyOutput[] | undefined): string[] | undefined {
  if (!Array.isArray(dependencies)) return undefined;

  return nonEmpty(
    dependencies.map((dependency) => {
      const source = dependency.source_context ?? "unknown";
      const target = dependency.target_context ?? "unknown";
      const symbols = dependency.referenced_symbols?.length ? ` (${dependency.referenced_symbols.join(", ")})` : "";
      return `${source} depends on ${target}${symbols}`;
    }),
  );
}

function formatIntent(intent: IntentOutput | undefined): string | undefined {
  if (!intent) return undefined;
  const input = intent.input_shape ?? intent.name;
  if (!input && !intent.actor) return undefined;
  return intent.actor ? `${input ?? "Intent"} from ${intent.actor}` : input;
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
