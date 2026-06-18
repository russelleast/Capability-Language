import { DclSourceLocation } from "../source/DclSourceLocation";

export type DclGraphNode = {
  id: string;
  label: string;
  sourceName?: string;
  kind: string;
  source?: DclSourceLocation;
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
