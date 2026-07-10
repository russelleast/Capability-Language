import { DclGraphModel } from "./DclGraphModel";

export type GraphLayoutPosition = {
  x: number;
  y: number;
};

export type GraphLayoutPositions = Record<string, GraphLayoutPosition>;

const KIND_ORDER = [
  "intent",
  "capability",
  "rule",
  "policy",
  "effect",
  "outcome",
  "event",
  "lifecycle-transition",
  "step",
  "terminal-step",
];

export function weaklyConnectedComponents(graph: DclGraphModel): string[][] {
  const adjacency = new Map<string, Set<string>>();
  for (const node of graph.nodes) adjacency.set(node.id, new Set());
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;
    adjacency.get(edge.source)!.add(edge.target);
    adjacency.get(edge.target)!.add(edge.source);
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  for (const node of sortedNodesForLayout(graph)) {
    if (visited.has(node.id)) continue;
    const queue = [node.id];
    const ids: string[] = [];
    visited.add(node.id);
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index];
      ids.push(id);
      for (const next of adjacency.get(id) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    components.push(ids.sort((a, b) => compareNodes(graph, a, b)));
  }

  return components.sort((a, b) => compareComponents(graph, a, b));
}

export function causeEffectLayoutPositions(graph: DclGraphModel): GraphLayoutPositions {
  const components = weaklyConnectedComponents(graph);
  const positions: GraphLayoutPositions = {};
  const componentGapX = 260;
  const componentGapY = 170;
  const maxRowWidth = 980;
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const component of components) {
    const layout = layoutComponent(graph, component);
    if (cursorX > 0 && cursorX + layout.width > maxRowWidth) {
      cursorX = 0;
      cursorY += rowHeight + componentGapY;
      rowHeight = 0;
    }

    for (const [id, position] of Object.entries(layout.positions)) {
      positions[id] = { x: position.x + cursorX, y: position.y + cursorY };
    }
    cursorX += layout.width + componentGapX;
    rowHeight = Math.max(rowHeight, layout.height);
  }

  return centerPositions(positions);
}

function layoutComponent(graph: DclGraphModel, component: string[]): { width: number; height: number; positions: GraphLayoutPositions } {
  const columnWidth = 190;
  const rowHeight = 106;
  const nodes = new Set(component);
  const byRank = new Map<number, string[]>();

  for (const id of component) {
    const rank = rankForKind(graph.nodes.find((node) => node.id === id)?.kind);
    const list = byRank.get(rank) ?? [];
    list.push(id);
    byRank.set(rank, list);
  }

  const ranks = Array.from(byRank.keys()).sort((a, b) => a - b);
  const positions: GraphLayoutPositions = {};
  let width = 0;
  let height = 0;

  ranks.forEach((rank, columnIndex) => {
    const ids = (byRank.get(rank) ?? []).filter((id) => nodes.has(id)).sort((a, b) => compareNodes(graph, a, b));
    const startY = -((ids.length - 1) * rowHeight) / 2;
    ids.forEach((id, rowIndex) => {
      positions[id] = { x: columnIndex * columnWidth, y: startY + rowIndex * rowHeight };
    });
    width = Math.max(width, columnIndex * columnWidth + 150);
    height = Math.max(height, Math.max(1, ids.length) * rowHeight);
  });

  const minY = Math.min(...Object.values(positions).map((position) => position.y));
  for (const position of Object.values(positions)) position.y -= minY;

  return { width, height, positions };
}

function centerPositions(positions: GraphLayoutPositions): GraphLayoutPositions {
  const values = Object.values(positions);
  if (!values.length) return positions;
  const minX = Math.min(...values.map((position) => position.x));
  const maxX = Math.max(...values.map((position) => position.x));
  const minY = Math.min(...values.map((position) => position.y));
  const maxY = Math.max(...values.map((position) => position.y));
  const offsetX = (minX + maxX) / 2;
  const offsetY = (minY + maxY) / 2;
  return Object.fromEntries(Object.entries(positions).map(([id, position]) => [id, {
    x: position.x - offsetX,
    y: position.y - offsetY,
  }]));
}

function rankForKind(kind: string | undefined): number {
  const index = kind ? KIND_ORDER.indexOf(kind) : -1;
  return index >= 0 ? index : KIND_ORDER.length;
}

function compareComponents(graph: DclGraphModel, left: string[], right: string[]): number {
  const leftRank = Math.min(...left.map((id) => rankForKind(graph.nodes.find((node) => node.id === id)?.kind)));
  const rightRank = Math.min(...right.map((id) => rankForKind(graph.nodes.find((node) => node.id === id)?.kind)));
  return leftRank - rightRank || compareNodes(graph, left[0], right[0]);
}

function compareNodes(graph: DclGraphModel, leftId: string, rightId: string): number {
  const left = graph.nodes.find((node) => node.id === leftId);
  const right = graph.nodes.find((node) => node.id === rightId);
  return rankForKind(left?.kind) - rankForKind(right?.kind)
    || String(left?.label ?? leftId).localeCompare(String(right?.label ?? rightId))
    || leftId.localeCompare(rightId);
}

function sortedNodesForLayout(graph: DclGraphModel): DclGraphModel["nodes"] {
  return graph.nodes.slice().sort((a, b) => rankForKind(a.kind) - rankForKind(b.kind)
    || a.label.localeCompare(b.label)
    || a.id.localeCompare(b.id));
}
