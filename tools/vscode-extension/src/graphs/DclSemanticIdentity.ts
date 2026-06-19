import type { DclGraphModel, DclGraphNode } from "./DclGraphModel";

export type DclSemanticIdentityKind =
  | "capability"
  | "context"
  | "event"
  | "effect"
  | "policy"
  | "lifecycle"
  | "lifecycle-step"
  | "lifecycle-transition";

export type DclSemanticIdentity = {
  kind: DclSemanticIdentityKind;
  name: string;
};

export function semanticIdentity(kind: DclSemanticIdentityKind, name: string | undefined): DclSemanticIdentity | undefined {
  const normalizedName = name?.trim();
  return normalizedName ? { kind, name: normalizedName } : undefined;
}

export function semanticIdentityEquals(left: DclSemanticIdentity | undefined, right: DclSemanticIdentity | undefined): boolean {
  return Boolean(left && right && left.kind === right.kind && left.name === right.name);
}

export function findGraphNodeBySemanticIdentity(
  graph: DclGraphModel | undefined,
  identity: DclSemanticIdentity | undefined,
): DclGraphNode | undefined {
  if (!graph || !identity) return undefined;
  return graph.nodes.find((node) => semanticIdentityEquals(node.semanticIdentity, identity));
}
