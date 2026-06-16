import type { Diagnostic } from "./compiler";
import type { CapabilitySummary, SemanticSummary } from "./semantic-summary";

export type VisualPrimitiveKey =
  | "intents"
  | "outcomes"
  | "rules"
  | "effects"
  | "events"
  | "policies"
  | "lifecycle";

export type VisualCapability = {
  id: string;
  name: string;
  contextName: string;
  summary: CapabilitySummary;
  counts: Record<VisualPrimitiveKey, number>;
  complexityScore: number;
  heatLevel: "quiet" | "warm" | "rich" | "dense";
  diagnostics: Diagnostic[];
};

export type VisualContext = {
  id: string;
  name: string;
  dependencies: string[];
  capabilities: VisualCapability[];
  complexityScore: number;
};

export type VisualModel = {
  contexts: VisualContext[];
  capabilities: VisualCapability[];
};

const unscopedContext = "Unscoped";

export function createVisualModel(summary: SemanticSummary, diagnostics: Diagnostic[] = []): VisualModel {
  const contextDependencies = new Map(
    (summary.contexts ?? []).map((context) => [displayContextName(context.name), context.dependencies ?? []]),
  );
  const contexts = new Map<string, VisualContext>();

  for (const context of summary.contexts ?? []) {
    const name = displayContextName(context.name);
    contexts.set(name, {
      id: name,
      name,
      dependencies: context.dependencies ?? [],
      capabilities: [],
      complexityScore: 0,
    });
  }

  const capabilities = summary.capabilities.map((capability) => {
    const contextName = displayContextName(capability.context);
    const visualCapability = toVisualCapability(capability, contextName, diagnostics);
    const context =
      contexts.get(contextName) ??
      {
        id: contextName,
        name: contextName,
        dependencies: contextDependencies.get(contextName) ?? [],
        capabilities: [],
        complexityScore: 0,
      };

    context.capabilities.push(visualCapability);
    context.complexityScore += visualCapability.complexityScore;
    contexts.set(contextName, context);
    return visualCapability;
  });

  return {
    capabilities,
    contexts: Array.from(contexts.values())
      .filter((context) => context.capabilities.length > 0 || context.dependencies.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function toVisualCapability(
  capability: CapabilitySummary,
  contextName: string,
  diagnostics: Diagnostic[],
): VisualCapability {
  const lifecycleCount = (capability.lifecycle?.steps?.length ?? 0) + (capability.lifecycle?.transitions?.length ?? 0);
  const counts: Record<VisualPrimitiveKey, number> = {
    intents: capability.intents?.length ?? 0,
    outcomes: capability.outcomes?.length ?? 0,
    rules: capability.rules?.length ?? 0,
    effects: capability.effects?.length ?? 0,
    events: capability.events?.length ?? 0,
    policies: capability.policies?.length ?? 0,
    lifecycle: lifecycleCount,
  };
  const complexityScore =
    counts.intents +
    counts.outcomes +
    counts.rules * 2 +
    counts.effects * 2 +
    counts.events * 2 +
    counts.policies * 2 +
    counts.lifecycle;

  return {
    id: `${contextName}:${capability.name}`,
    name: capability.name,
    contextName,
    summary: capability,
    counts,
    complexityScore,
    heatLevel: heatLevel(complexityScore),
    diagnostics: diagnostics.filter((diagnostic) => diagnosticMatchesCapability(diagnostic, capability.name)),
  };
}

function heatLevel(score: number): VisualCapability["heatLevel"] {
  if (score >= 14) return "dense";
  if (score >= 9) return "rich";
  if (score >= 5) return "warm";
  return "quiet";
}

function displayContextName(context: string | undefined): string {
  if (!context || context === "default") return unscopedContext;
  return context;
}

function diagnosticMatchesCapability(diagnostic: Diagnostic, capabilityName: string): boolean {
  const haystack = [diagnostic.code, diagnostic.message].filter(Boolean).join(" ");
  return haystack.includes(capabilityName);
}
