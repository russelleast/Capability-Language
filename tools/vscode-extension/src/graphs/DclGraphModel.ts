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
};

export type DclGraphModel = {
  title: string;
  nodes: DclGraphNode[];
  edges: DclGraphEdge[];
};
