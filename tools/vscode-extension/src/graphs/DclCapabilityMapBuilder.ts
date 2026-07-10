import { CapabilitySummary, ContextSummary, SemanticDiagnosticSummary, SemanticSummary, SourceLocation } from "../views/semanticSummary";
import { DclSemanticIdentity, semanticIdentity } from "./DclSemanticIdentity";

export const CAPABILITY_MAP_DESCRIPTION = "The Capability Map shows declared capabilities grouped by DCL context. It is a responsibility map, not a dependency, runtime, service, or infrastructure diagram.";

export type DclCapabilityMapBadgeKind = "lifecycle" | "effects" | "events" | "policies" | "diagnostics";

export type DclCapabilityMapBadge = {
  kind: DclCapabilityMapBadgeKind;
  label: string;
  count?: number;
};

export type DclCapabilityMapCapability = {
  id: string;
  name: string;
  context?: string;
  kind: "capability";
  source?: SourceLocation;
  semanticIdentity: DclSemanticIdentity;
  badges: DclCapabilityMapBadge[];
  diagnostics?: SemanticDiagnosticSummary[];
};

export type DclCapabilityMapContext = {
  id: string;
  name: string;
  kind: "context";
  synthetic?: boolean;
  source?: SourceLocation;
  semanticIdentity: DclSemanticIdentity;
  capabilities: DclCapabilityMapCapability[];
  children: DclCapabilityMapContext[];
};

export type DclCapabilityMapItem = DclCapabilityMapContext | DclCapabilityMapCapability;

export type DclCapabilityMapModel = {
  title: string;
  description: string;
  root: DclCapabilityMapContext;
  warnings?: string[];
};

const SYNTHETIC_ROOT_CONTEXT = "__capability_map_root__";

export function buildCapabilityMap(summary: SemanticSummary): DclCapabilityMapModel | undefined {
  if (!summary.capabilities.length) return undefined;

  const warnings: string[] = [];
  const declaredContexts = declaredContextSummaries(summary.contexts);
  const contextByName = new Map(declaredContexts.map((context) => [context.name, context]));
  const parentByChild = parentByChildContext(declaredContexts);
  const root = contextContainer(SYNTHETIC_ROOT_CONTEXT, undefined, true);
  const containerByName = new Map<string, DclCapabilityMapContext>();

  for (const context of declaredContexts) {
    containerByName.set(context.name, contextContainer(context.name, context.location));
  }

  for (const context of declaredContexts) {
    const container = containerByName.get(context.name);
    if (!container) continue;
    const parentName = context.parent ?? parentByChild.get(context.name);
    const parent = parentName ? containerByName.get(parentName) : root;
    if (parent) {
      parent.children.push(container);
    } else {
      warnings.push(`Context '${context.name}' references missing parent context '${parentName}', so it is shown in an unlabelled top-level map area.`);
      root.children.push(container);
    }
  }

  const childNames = new Set([
    ...declaredContexts.filter((context) => context.parent).map((context) => context.name),
    ...parentByChild.keys(),
  ]);
  for (const context of declaredContexts) {
    if (!context.parent && !childNames.has(context.name) && !root.children.some((child) => child.name === context.name)) {
      root.children.push(containerByName.get(context.name)!);
    }
  }

  for (const capability of summary.capabilities) {
    const diagnostics = diagnosticsForCapability(summary.diagnostics, capability);
    const tile = capabilityTile(capability, diagnostics);
    const ownerName = capability.context;
    const owner = ownerName ? containerByName.get(ownerName) : undefined;
    if (owner) {
      owner.capabilities.push(tile);
    } else {
      if (ownerName && !contextByName.has(ownerName)) {
        warnings.push(`Capability '${capability.name}' references context '${ownerName}', but that declared context was not available, so it is shown in an unlabelled fallback area.`);
      }
      root.capabilities.push(tile);
    }
  }

  sortContext(root);

  return {
    title: "DCL Capability Map",
    description: CAPABILITY_MAP_DESCRIPTION,
    root,
    warnings: dedupe(warnings),
  };
}

export function capabilityMapItems(map: DclCapabilityMapModel | undefined): DclCapabilityMapItem[] {
  if (!map) return [];
  const items: DclCapabilityMapItem[] = [];
  visitContext(map.root, (context) => {
    items.push(context);
    items.push(...context.capabilities);
  });
  return items;
}

export function findCapabilityMapItemBySemanticIdentity(
  map: DclCapabilityMapModel | undefined,
  identity: DclSemanticIdentity | undefined,
): DclCapabilityMapItem | undefined {
  if (!identity) return undefined;
  return capabilityMapItems(map).find((item) => (
    item.semanticIdentity.kind === identity.kind
    && item.semanticIdentity.name === identity.name
  ));
}

function declaredContextSummaries(contexts: ContextSummary[] | undefined): ContextSummary[] {
  return (contexts ?? []).filter((context) => context.name !== "Workspace");
}

function parentByChildContext(contexts: ContextSummary[]): Map<string, string> {
  const parents = new Map<string, string>();
  for (const context of contexts) {
    for (const child of context.children ?? []) {
      if (!parents.has(child)) parents.set(child, context.name);
    }
  }
  return parents;
}

function contextContainer(name: string, source?: SourceLocation, synthetic = false): DclCapabilityMapContext {
  return {
    id: synthetic ? "context:root" : `context:${slug(name)}`,
    name: synthetic ? "" : name,
    kind: "context",
    synthetic,
    source,
    semanticIdentity: semanticIdentity("context", synthetic ? "root" : name)!,
    capabilities: [],
    children: [],
  };
}

function capabilityTile(
  capability: CapabilitySummary,
  diagnostics: SemanticDiagnosticSummary[] | undefined,
): DclCapabilityMapCapability {
  return {
    id: `capability:${slug(capability.name)}`,
    name: capability.name,
    context: capability.context,
    kind: "capability",
    source: capability.location,
    semanticIdentity: semanticIdentity("capability", capability.name)!,
    badges: [],
    diagnostics,
  };
}

function diagnosticsForCapability(
  diagnostics: SemanticDiagnosticSummary[] | undefined,
  capability: CapabilitySummary,
): SemanticDiagnosticSummary[] | undefined {
  const matched = (diagnostics ?? []).filter((diagnostic) => {
    if (diagnostic.severity !== "warning") return false;
    if (diagnostic.node === capability.name || diagnostic.node === capability.id) return true;
    if (!diagnostic.location || !capability.location) return false;
    return diagnostic.location.file === capability.location.file
      && diagnostic.location.line === capability.location.line
      && diagnostic.location.column === capability.location.column;
  });
  return matched.length ? matched : undefined;
}

function visitContext(context: DclCapabilityMapContext, visitor: (context: DclCapabilityMapContext) => void): void {
  visitor(context);
  for (const child of context.children) visitContext(child, visitor);
}

function sortContext(context: DclCapabilityMapContext): void {
  context.capabilities.sort((a, b) => a.name.localeCompare(b.name));
  context.children.sort((a, b) => a.name.localeCompare(b.name));
  for (const child of context.children) sortContext(child);
}

function dedupe(items: string[]): string[] | undefined {
  const values = Array.from(new Set(items));
  return values.length ? values : undefined;
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
