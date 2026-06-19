import { describe, expect, it } from "vitest";
import { buildArchitectureOverviewGraph, buildArchitectureOverviewGraphs } from "../../src/graphs/DclArchitectureOverviewGraphBuilder";
import { SemanticSummary } from "../../src/views/semanticSummary";

describe("DclArchitectureOverviewGraphBuilder", () => {
  it("builds overview detail level with contexts and capabilities only", () => {
    const graph = buildArchitectureOverviewGraph(summary({
      contexts: [{ name: "Sales" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales", eventDetails: [{ event: "OrderAccepted", label: "OrderAccepted" }] }],
    }), "overview");

    expect(graph.nodes.map((node) => node.kind)).toEqual(["context", "capability"]);
    expect(graph.edges.map((edge) => edge.kind)).toEqual(["contains-capability"]);
  });

  it("builds detailed detail level with emitted events", () => {
    const graph = buildArchitectureOverviewGraph(summary({
      contexts: [{ name: "Sales" }],
      events: [{ label: "OrderAccepted" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales", eventDetails: [{ event: "OrderAccepted", label: "OrderAccepted" }] }],
    }), "detailed");

    expect(graph.nodes.map((node) => node.kind)).toEqual(["context", "capability", "event"]);
    expect(graph.edges.map((edge) => edge.label)).toEqual(["contains", "emits"]);
  });

  it("builds full detail level with lifecycle indicators", () => {
    const graph = buildArchitectureOverviewGraph(summary({
      contexts: [{ name: "Sales" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales", lifecycle: { begin: "Started" } }],
    }), "full");

    expect(graph.nodes.map((node) => node.kind)).toEqual(["context", "capability", "lifecycle"]);
    expect(graph.edges.map((edge) => edge.label)).toEqual(["contains", "has lifecycle"]);
  });

  it("renders context contains capability", () => {
    const graph = buildArchitectureOverviewGraph(summary({
      contexts: [{ name: "Sales" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales" }],
    }), "overview");

    expect(graph.edges[0]).toMatchObject({ source: "context:sales", target: "capability:acceptorder", label: "contains" });
  });

  it("renders parent-child context hierarchy", () => {
    const graph = buildArchitectureOverviewGraph(summary({
      contexts: [{ name: "Commerce", children: ["Sales"] }, { name: "Sales", parent: "Commerce" }],
    }), "overview");

    expect(graph.edges.find((edge) => edge.kind === "contains-context")).toMatchObject({
      source: "context:commerce",
      target: "context:sales",
      label: "contains",
    });
  });

  it("renders capability emits event", () => {
    const graph = buildArchitectureOverviewGraph(summary({
      capabilities: [{ name: "AcceptOrder", eventDetails: [{ event: "OrderAccepted", label: "OrderAccepted" }] }],
    }), "detailed");

    expect(graph.edges.find((edge) => edge.kind === "emits")).toMatchObject({
      source: "capability:acceptorder",
      target: "event:orderaccepted",
    });
  });

  it("renders lifecycle indicators in full detail", () => {
    const graph = buildArchitectureOverviewGraph(summary({
      capabilities: [{ name: "AcceptOrder", lifecycle: { begin: "Started" } }],
    }), "full");

    expect(graph.nodes.find((node) => node.kind === "lifecycle")).toMatchObject({
      label: "Accept Order Lifecycle",
      sourceName: "AcceptOrder lifecycle",
    });
  });

  it("uses Workspace when context data is missing", () => {
    const graph = buildArchitectureOverviewGraph(summary({
      capabilities: [{ name: "AcceptOrder" }],
    }), "overview");

    expect(graph.nodes.find((node) => node.label === "Workspace")?.kind).toBe("context");
    expect(graph.edges[0]).toMatchObject({ source: "context:workspace", target: "capability:acceptorder" });
  });

  it("does not use an empty default context for capabilities without attached context", () => {
    const graph = buildArchitectureOverviewGraph(summary({
      contexts: [{ name: "default" }],
      capabilities: [{ name: "AcceptOrder" }],
    }), "overview");

    expect(graph.nodes.find((node) => node.id === "context:default")).toBeUndefined();
    expect(graph.nodes.filter((node) => node.label === "Workspace")).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ source: "context:workspace", target: "capability:acceptorder" });
  });

  it("uses Workspace for capabilities without contexts when no default context exists", () => {
    const graph = buildArchitectureOverviewGraph(summary({
      contexts: [{ name: "Sales" }],
      capabilities: [{ name: "AcceptOrder" }],
    }), "overview");

    expect(graph.nodes.find((node) => node.label === "Workspace")?.kind).toBe("context");
    expect(graph.nodes.find((node) => node.label === "Uncontexted")).toBeUndefined();
    expect(graph.edges[0]).toMatchObject({ source: "context:workspace", target: "capability:acceptorder" });
  });

  it("does not render duplicate fallback context nodes", () => {
    const graph = buildArchitectureOverviewGraph(summary({
      contexts: [{ name: "default" }, { name: "Workspace" }, { name: "Uncontexted" }],
      capabilities: [{ name: "AcceptOrder" }, { name: "ShipOrder" }],
    }), "overview");

    expect(graph.nodes.find((node) => node.id === "context:default")).toBeUndefined();
    expect(graph.nodes.filter((node) => node.label === "Workspace")).toHaveLength(1);
    expect(graph.nodes.find((node) => node.label === "Uncontexted")).toBeUndefined();
  });

  it("does not render empty synthetic default context when explicit contexts contain all capabilities", () => {
    const graph = buildArchitectureOverviewGraph(summary({
      contexts: [{ name: "default" }, { name: "Sales" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales" }],
    }), "overview");

    expect(graph.nodes.find((node) => node.id === "context:default")).toBeUndefined();
    expect(graph.nodes.find((node) => node.label === "Workspace")).toBeUndefined();
    expect(graph.nodes.map((node) => node.id)).toContain("context:sales");
  });

  it("renders real default context when it contains declarations", () => {
    const graph = buildArchitectureOverviewGraph(summary({
      contexts: [{ name: "default" }],
      capabilities: [{ name: "AcceptOrder", context: "default" }],
    }), "overview");

    expect(graph.nodes.filter((node) => node.id === "context:default")).toHaveLength(1);
    expect(graph.nodes.find((node) => node.label === "Workspace")).toBeUndefined();
    expect(graph.edges[0]).toMatchObject({ source: "context:default", target: "capability:acceptorder" });
  });

  it("handles incomplete compiler summaries", () => {
    expect(buildArchitectureOverviewGraphs({ capabilities: [] })).toBeUndefined();
  });
});

function summary(value: Partial<SemanticSummary>): SemanticSummary {
  return {
    capabilities: [],
    ...value,
  };
}
