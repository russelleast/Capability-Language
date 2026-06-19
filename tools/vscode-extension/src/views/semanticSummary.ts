import { DclSourceLocation, normalizeSourceLocation as normalizeCompilerSourceLocation } from "../source/DclSourceLocation";

export type SemanticSummary = {
  capabilities: CapabilitySummary[];
  contexts?: ContextSummary[];
  actors?: SemanticItem[];
  policies?: SemanticItem[];
  effects?: SemanticItem[];
  events?: SemanticItem[];
  lifecycles?: SemanticItem[];
};

export type ContextSummary = {
  name: string;
  parent?: string;
  children?: string[];
  dependencies?: string[];
  location?: SourceLocation;
};

export type SourceLocation = DclSourceLocation;

export type SemanticItem = {
  label: string;
  location?: SourceLocation;
};

export type CapabilitySummary = {
  id?: string;
  name: string;
  context?: string;
  location?: SourceLocation;
  intents?: string[];
  actors?: string[];
  outcomes?: string[];
  rules?: string[];
  effects?: string[];
  events?: string[];
  eventDetails?: EventFlowSummary[];
  policies?: string[];
  lifecycle?: {
    begin?: string;
    ends?: string[];
    steps?: string[];
    transitions?: string[];
    stepDetails?: LifecycleStepSummary[];
    transitionDetails?: LifecycleTransitionSummary[];
  };
  itemLocations?: Partial<Record<CapabilityItemKind, Record<string, SourceLocation>>>;
};

export type CapabilityItemKind = "intents" | "actors" | "outcomes" | "rules" | "effects" | "events" | "policies" | "lifecycle";

export type LifecycleStepSummary = {
  name: string;
  kind?: string;
  isTerminal?: boolean;
};

export type LifecycleTransitionSummary = {
  from: string;
  to: string;
  triggerKind?: string;
  triggerName?: string;
  sourceCapability?: string;
};

export type EventFlowSummary = {
  event: string;
  label: string;
  sourceOutcome?: string;
};

type ProgramOutput = {
  capabilities?: CapabilityOutput[];
  contexts?: ContextOutput[];
  actors?: NamedOutput[];
  policies?: NamedOutput[];
  effects?: NamedOutput[];
  events?: NamedOutput[];
  effective_policies?: EffectivePolicyOutput[];
  symbols?: SymbolOutput[];
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

type ContextOutput = {
  name?: string;
  parent?: string;
  children?: string[];
  dependencies?: string[];
};

type NamedOutput = {
  name?: string;
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
  source_locations?: SourceLocationOutput[];
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

export type SymbolOutput = {
  name?: string;
  kind?: string;
  context?: string;
  declared?: string;
};

type SourceLocationOutput = {
  file?: string;
  line?: number;
  column?: number;
};

type SymbolLocationIndex = Map<string, SourceLocation>;

export function summarizeCompilerOutput(output: unknown): SemanticSummary {
  const program = isObject(output) ? (output as ProgramOutput) : {};
  const effectivePolicies = Array.isArray(program.effective_policies) ? program.effective_policies.filter(isObject) as EffectivePolicyOutput[] : [];
  const symbolLocations = symbolLocationIndex(program.symbols);
  const symbols = Array.isArray(program.symbols) ? program.symbols.filter(isObject) as SymbolOutput[] : [];
  const capabilities = Array.isArray(program.capabilities) ? program.capabilities.filter(isObject) as CapabilityOutput[] : [];
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

function summarizeCapability(
  capability: CapabilityOutput,
  effectivePolicies: EffectivePolicyOutput[],
  symbolLocations: SymbolLocationIndex,
): CapabilitySummary {
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

function summarizeItemLocations(
  capability: CapabilityOutput,
  effectivePolicies: EffectivePolicyOutput[],
  symbolLocations: SymbolLocationIndex,
  context: string | undefined,
): CapabilitySummary["itemLocations"] {
  const locations: NonNullable<CapabilitySummary["itemLocations"]> = {};

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
    if (!isObject(event)) continue;
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

function addItemLocation(
  locations: NonNullable<CapabilitySummary["itemLocations"]>,
  kind: CapabilityItemKind,
  label: string | undefined,
  location: SourceLocation | undefined,
): void {
  if (!label || !location) return;
  locations[kind] ??= {};
  locations[kind][label] = location;
}

function summarizeContexts(contexts: ContextOutput[] | undefined, symbolLocations: SymbolLocationIndex): ContextSummary[] | undefined {
  if (!Array.isArray(contexts)) return undefined;

  return nonEmpty(
    contexts.map((context) => isObject(context) ? ({
      name: context.name ?? "Unnamed context",
      parent: context.parent,
      children: nonEmpty(arrayItems(context.children)),
      dependencies: nonEmpty(arrayItems(context.dependencies)),
      location: context.name ? symbolLocation(symbolLocations, "context", context.name, context.name) : undefined,
    }) : undefined),
  );
}

export function normalizeContextsForDisplay(
  contexts: ContextSummary[] | undefined,
  capabilities: CapabilitySummary[],
  symbols: SymbolOutput[] = [],
): ContextSummary[] | undefined {
  const result = (contexts ?? []).filter((context) => {
    if (!isSyntheticDefaultContext(context)) return true;
    return contextHasDeclarations(context, capabilities, symbols);
  });

  const hasUncontextedDeclarations = capabilities.some((capability) => !capability.context);
  if (hasUncontextedDeclarations && !result.some((context) => isWorkspaceFallbackContext(context))) {
    result.push({ name: "Workspace" });
  }

  return nonEmpty(dedupeContexts(result));
}

export function isSyntheticDefaultContext(context: ContextSummary): boolean {
  return context.name === "default" || isWorkspaceFallbackContext(context) || context.name === "Uncontexted";
}

export function contextHasDeclarations(
  context: ContextSummary,
  capabilities: CapabilitySummary[],
  symbols: SymbolOutput[] = [],
): boolean {
  if (context.children?.length || context.dependencies?.length) return true;
  if (capabilities.some((capability) => capability.context === context.name)) return true;
  return symbols.some((symbol) => symbol.kind !== "context" && symbol.context === context.name);
}

function isWorkspaceFallbackContext(context: ContextSummary): boolean {
  return context.name === "Workspace";
}

function dedupeContexts(contexts: ContextSummary[]): ContextSummary[] {
  return Array.from(new Map(contexts.map((context) => [context.name, context])).values());
}

function topLevelItems(items: NamedOutput[] | undefined, kind: string, symbolLocations: SymbolLocationIndex): SemanticItem[] | undefined {
  if (!Array.isArray(items)) return undefined;
  return nonEmpty(
    items.map((item) => {
      if (!isObject(item)) return undefined;
      if (!item.name) return undefined;
      return { label: item.name, location: symbolLocation(symbolLocations, kind, item.name, undefined) };
    }),
  );
}

function formatLifecycleItem(capability: CapabilityOutput): SemanticItem | undefined {
  const lifecycle = capability.lifecycle;
  if (!lifecycle) return undefined;
  const label = lifecycle.name ?? lifecycle.id ?? capability.name;
  return label ? { label, location: undefined } : undefined;
}

function contextFromCapabilityId(id: string | undefined, name: string): string | undefined {
  if (!id) return undefined;
  const withoutKind = id.replace(/^capability:/, "");
  if (withoutKind === name || !withoutKind.endsWith(`.${name}`)) return undefined;
  return withoutKind.slice(0, -name.length - 1) || undefined;
}

function symbolLocationIndex(symbols: SymbolOutput[] | undefined): SymbolLocationIndex {
  const index: SymbolLocationIndex = new Map();
  if (!Array.isArray(symbols)) return index;

  for (const symbol of symbols) {
    if (!isObject(symbol)) continue;
    if (!symbol.kind || !symbol.name) continue;
    const location = parseDeclaredLocation(symbol.declared);
    if (!location) continue;
    index.set(symbolKey(symbol.kind, symbol.name, symbol.context), location);
    index.set(symbolKey(symbol.kind, symbol.name, undefined), location);
  }

  return index;
}

function arrayItems<T>(items: T[] | undefined): T[] {
  return Array.isArray(items) ? items : [];
}

function symbolLocation(index: SymbolLocationIndex, kind: string, name: string | undefined, context: string | undefined): SourceLocation | undefined {
  if (!name) return undefined;
  return index.get(symbolKey(kind, name, context)) ?? index.get(symbolKey(kind, name, undefined));
}

function symbolKey(kind: string, name: string, context: string | undefined): string {
  return `${kind}:${context ?? ""}:${name}`;
}

function parseDeclaredLocation(declared: string | undefined): SourceLocation | undefined {
  if (!declared) return undefined;
  const match = /^(.*):(\d+):(\d+)$/.exec(declared);
  if (!match) return undefined;
  return normalizedCompilerLocation({
    file: match[1],
    line: Number(match[2]),
    column: Number(match[3]),
  });
}

function normalizedCompilerLocation(location: SourceLocationOutput | undefined): SourceLocation | undefined {
  const normalized = normalizeCompilerSourceLocation(location, "oneBased");
  if (!normalized.ok) return undefined;
  return {
    file: normalized.location.file,
    line: normalized.location.line + 1,
    column: normalized.location.column + 1,
    indexBase: "oneBased",
  };
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
  return arrayItems(policy.applied_policies).map((name) => (target ? `${name} applies to ${target}` : name));
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

function summarizeLifecycleStep(step: LifecycleStepOutput | undefined): LifecycleStepSummary | undefined {
  if (!step?.name) return undefined;
  return {
    name: step.name,
    kind: step.kind,
    isTerminal: step.is_terminal,
  };
}

function summarizeLifecycleTransition(transition: TransitionOutput | undefined): LifecycleTransitionSummary | undefined {
  if (!transition?.from || !transition.to) return undefined;
  return {
    from: transition.from,
    to: transition.to,
    triggerKind: transition.trigger_kind,
    triggerName: transition.trigger_name,
    sourceCapability: transition.source_capability,
  };
}

function summarizeEmittedEvent(event: EmittedEventOutput | undefined): EventFlowSummary | undefined {
  if (!isObject(event) || !event.event) return undefined;
  return {
    event: event.event,
    label: event.event,
  };
}

function summarizeEventEmission(event: EmitOutput | undefined): EventFlowSummary | undefined {
  if (!event?.event) return undefined;
  const label = formatEventEmission(event);
  if (!label) return undefined;
  return {
    event: event.event,
    label,
    sourceOutcome: event.outcome,
  };
}

function nonEmpty<T>(items: (T | undefined)[] | undefined): T[] | undefined {
  const filtered = items?.filter((item): item is T => item !== undefined && item !== "");
  return filtered?.length ? Array.from(new Set(filtered)) : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
