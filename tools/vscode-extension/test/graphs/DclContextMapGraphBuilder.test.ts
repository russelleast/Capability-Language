import { describe, expect, it } from "vitest";
import { buildContextMapGraph } from "../../src/graphs/DclContextMapGraphBuilder";
import { SemanticSummary } from "../../src/views/semanticSummary";

describe("DclContextMapGraphBuilder", () => {
  it("builds a graph for a single context", () => {
    const graph = buildContextMapGraph(summary({
      contexts: [{ name: "Sales", location: { file: "sales.dcl", line: 1, column: 1 } }],
    }));

    expect(graph?.nodes).toEqual([
      {
        id: "context:sales",
        label: "Sales",
        sourceName: "Sales",
        kind: "context",
        source: { file: "sales.dcl", line: 1, column: 1 },
        semanticIdentity: { kind: "context", name: "Sales" },
      },
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

  it("normalises dotted context labels without changing ids", () => {
    const graph = buildContextMapGraph(summary({
      contexts: [{ name: "Customer.Registration" }],
    }));

    expect(graph?.nodes[0]).toMatchObject({
      id: "context:customer-registration",
      label: "Customer / Registration",
      sourceName: "Customer.Registration",
    });
  });

  it("does not render an empty synthetic default context", () => {
    const graph = buildContextMapGraph(summary({
      contexts: [{ name: "default" }, { name: "Sales" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales" }],
    }));

    expect(graph?.nodes.find((node) => node.id === "context:default")).toBeUndefined();
    expect(graph?.nodes.map((node) => node.id)).toEqual(["context:sales"]);
  });

  it("renders real default context when it contains declarations", () => {
    const graph = buildContextMapGraph(summary({
      contexts: [{ name: "default" }],
      capabilities: [{ name: "AcceptOrder", context: "default" }],
    }));

    expect(graph?.nodes.map((node) => node.id)).toEqual(["context:default"]);
  });

  it("uses one Workspace fallback when declarations have no context", () => {
    const graph = buildContextMapGraph(summary({
      contexts: [{ name: "default" }, { name: "Workspace" }, { name: "Uncontexted" }],
      capabilities: [{ name: "AcceptOrder" }],
    }));

    expect(graph?.nodes.map((node) => node.label)).toEqual(["Workspace"]);
  });
});

function summary(value: Partial<SemanticSummary>): SemanticSummary {
  return {
    capabilities: [],
    ...value,
  };
}
