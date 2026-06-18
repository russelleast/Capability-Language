import { describe, expect, it } from "vitest";
import { buildContextMapGraph } from "../../src/graphs/DclContextMapGraphBuilder";
import { SemanticSummary } from "../../src/views/semanticSummary";

describe("DclContextMapGraphBuilder", () => {
  it("builds a graph for a single context", () => {
    const graph = buildContextMapGraph(summary({
      contexts: [{ name: "Sales", location: { file: "sales.dcl", line: 1, column: 1 } }],
    }));

    expect(graph?.nodes).toEqual([
      { id: "context:sales", label: "Sales", kind: "context", source: { file: "sales.dcl", line: 1, column: 1 } },
    ]);
    expect(graph?.edges).toEqual([]);
  });

  it("renders parent-child context hierarchy", () => {
    const graph = buildContextMapGraph(summary({
      contexts: [
        { name: "Commerce", children: ["Sales"] },
        { name: "Sales", parent: "Commerce" },
      ],
    }));

    expect(graph?.nodes.map((node) => node.kind)).toEqual(["context", "child-context"]);
    expect(graph?.edges.map((edge) => edge.label)).toEqual(["contains"]);
  });

  it("renders explicit context dependencies", () => {
    const graph = buildContextMapGraph(summary({
      contexts: [
        { name: "Sales", dependencies: ["Shared"] },
        { name: "Shared" },
      ],
    }));

    expect(graph?.edges).toMatchObject([
      { source: "context:sales", target: "context:shared", label: "depends on", kind: "depends-on" },
    ]);
  });

  it("renders multiple dependencies deterministically", () => {
    const graph = buildContextMapGraph(summary({
      contexts: [
        { name: "Sales", dependencies: ["Shared", "Identity"] },
        { name: "Shared" },
        { name: "Identity" },
      ],
    }));

    expect(graph?.edges.map((edge) => edge.target)).toEqual(["context:shared", "context:identity"]);
  });

  it("represents missing referenced contexts explicitly", () => {
    const graph = buildContextMapGraph(summary({
      contexts: [{ name: "Sales", dependencies: ["Missing"] }],
    }));

    expect(graph?.nodes.find((node) => node.label === "Missing")?.kind).toBe("external-context");
    expect(graph?.edges[0]).toMatchObject({ source: "context:sales", target: "context:missing", label: "depends on" });
  });

  it("does not invent source ranges when context summary data is unlocated", () => {
    const graph = buildContextMapGraph(summary({
      contexts: [{ name: "Unlocated" }],
    }));

    expect(graph?.nodes.every((node) => node.source === undefined)).toBe(true);
  });

  it("handles incomplete summaries without inventing contexts", () => {
    expect(buildContextMapGraph({ capabilities: [] })).toBeUndefined();
  });
});

function summary(value: Partial<SemanticSummary>): SemanticSummary {
  return {
    capabilities: [],
    ...value,
  };
}
