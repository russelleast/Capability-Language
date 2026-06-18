import { describe, expect, it } from "vitest";
import { buildLifecycleGraph, buildLifecycleGraphFromCapability } from "../../src/graphs/DclLifecycleGraphBuilder";
import { CapabilitySummary, SemanticSummary } from "../../src/views/semanticSummary";

describe("DclLifecycleGraphBuilder", () => {
  const capability: CapabilitySummary = {
    name: "RegisterCustomer",
    location: { file: "register.dcl", line: 1, column: 1 },
    lifecycle: {
      begin: "Pending",
      ends: ["Accepted"],
      stepDetails: [
        { name: "Pending" },
        { name: "Reviewing" },
        { name: "Accepted", isTerminal: true },
      ],
      transitionDetails: [
        { from: "Pending", to: "Reviewing", triggerKind: "outcome", triggerName: "Submitted" },
        { from: "Reviewing", to: "Accepted", triggerKind: "event", triggerName: "CustomerRegistered" },
      ],
    },
    itemLocations: {
      lifecycle: {
        Pending: { file: "register.dcl", line: 11, column: 5 },
      },
    },
  };

  it("builds a simple begin, step, and end lifecycle graph", () => {
    const graph = buildLifecycleGraphFromCapability(capability);

    expect(graph.title).toBe("RegisterCustomer Lifecycle Graph");
    expect(graph.nodes.map((node) => node.kind)).toEqual([
      "lifecycle",
      "initial-step",
      "step",
      "terminal-step",
    ]);
    expect(graph.edges.map((edge) => edge.label)).toEqual([
      "begins",
      "on outcome Submitted",
      "on event Customer Registered",
    ]);
  });

  it("marks multiple terminal states as terminal steps", () => {
    const graph = buildLifecycleGraphFromCapability({
      name: "ApproveRequest",
      lifecycle: {
        begin: "Draft",
        ends: ["Approved", "Rejected"],
        stepDetails: [
          { name: "Draft" },
          { name: "Approved", isTerminal: true },
          { name: "Rejected", isTerminal: true },
        ],
      },
    });

    expect(graph.nodes.filter((node) => node.kind === "terminal-step").map((node) => node.label)).toEqual(["Approved", "Rejected"]);
  });

  it("formats transition labels with outcome triggers", () => {
    const graph = buildLifecycleGraphFromCapability({
      name: "StartJob",
      lifecycle: {
        begin: "Queued",
        stepDetails: [{ name: "Queued" }, { name: "Running" }],
        transitionDetails: [{ from: "Queued", to: "Running", triggerKind: "outcome", triggerName: "JobStarted", sourceCapability: "StartJob" }],
      },
    });

    expect(graph.edges.find((edge) => edge.kind === "transition")?.label).toBe("on outcome Job Started from Start Job");
  });

  it("formats transition labels with event triggers", () => {
    const graph = buildLifecycleGraphFromCapability({
      name: "RegisterCustomer",
      lifecycle: {
        begin: "Pending",
        stepDetails: [{ name: "Pending" }, { name: "Registered" }],
        transitionDetails: [{ from: "Pending", to: "Registered", triggerKind: "event", triggerName: "CustomerRegistered" }],
      },
    });

    expect(graph.edges.find((edge) => edge.kind === "transition")?.label).toBe("on event Customer Registered");
  });

  it("uses a stable fallback label when transition trigger data is missing", () => {
    const graph = buildLifecycleGraphFromCapability({
      name: "ManualReview",
      lifecycle: {
        begin: "Open",
        stepDetails: [{ name: "Open" }, { name: "Closed" }],
        transitionDetails: [{ from: "Open", to: "Closed" }],
      },
    });

    expect(graph.edges.find((edge) => edge.kind === "transition")?.label).toBe("transition");
  });

  it("does not invent source ranges when lifecycle summary data is unlocated", () => {
    const graph = buildLifecycleGraphFromCapability({
      name: "Unlocated",
      lifecycle: {
        begin: "Open",
        stepDetails: [{ name: "Open" }],
      },
    });

    expect(graph.nodes.every((node) => node.source === undefined)).toBe(true);
  });

  it("selects one lifecycle by capability name from a semantic summary", () => {
    const summary: SemanticSummary = { capabilities: [capability] };
    expect(buildLifecycleGraph(summary, "RegisterCustomer")?.nodes[0]).toMatchObject({
      id: "lifecycle:registercustomer",
      label: "Register Customer Lifecycle",
      sourceName: "RegisterCustomer lifecycle",
    });
    expect(buildLifecycleGraph(summary, "Missing")).toBeUndefined();
  });
});
