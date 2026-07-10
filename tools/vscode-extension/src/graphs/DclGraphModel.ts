import type { DclSourceLocation } from "../source/DclSourceLocation";
import type { DclSemanticIdentity } from "./DclSemanticIdentity";

export type DclGraphNode = {
  id: string;
  label: string;
  sourceName?: string;
  kind: string;
  source?: DclSourceLocation;
  semanticIdentity?: DclSemanticIdentity;
};

export type DclGraphEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: string;
  score?: number;
  reasons?: DclGraphEdgeReason[];
};

export type DclGraphEdgeReason = {
  kind: string;
  label: string;
  score: number;
  detail: string;
};

export type DclGraphModel = {
  title: string;
  description?: string;
  warnings?: string[];
  nodes: DclGraphNode[];
  edges: DclGraphEdge[];
};
