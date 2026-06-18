import { describe, expect, it } from "vitest";
import { buildEventFlowGraph } from "../../src/graphs/DclEventFlowGraphBuilder";
import { SemanticSummary } from "../../src/views/semanticSummary";

describe("DclEventFlowGraphBuilder", () => {
  it("builds a graph for a single capability emitting an event", () => {
    const graph = buildEventFlowGraph(summary({
      events: [{ label: "CustomerRegistered" }],
      capabilities: [
        { name: "RegisterCustomer", eventDetails: [{ event: "CustomerRegistered", label: "CustomerRegistered" }] },
      ],
    }), "CustomerRegistered");

    expect(graph?.nodes.map((node) => node.kind)).toEqual(["event", "capability"]);
    expect(graph?.edges.map((edge) => edge.label)).toEqual(["emits"]);
  });

  it("adds event-triggered lifecycle transitions where compiler summary provides them", () => {
    const graph = buildEventFlowGraph(summary({
      events: [{ label: "CustomerRegistered" }],
      capabilities: [
        {
          name: "VerifyCustomer",
          lifecycle: {
            transitionDetails: [{ from: "Pending", to: "Verified", triggerKind: "event", triggerName: "CustomerRegistered" }],
          },
        },
      ],
    }), "CustomerRegistered");

    expect(graph?.nodes.map((node) => node.kind)).toEqual(["event", "capability", "lifecycle", "lifecycle-transition"]);
    expect(graph?.edges.map((edge) => edge.label)).toEqual(["triggers transition", "references", "in lifecycle"]);
  });

  it("connects one emitting capability to another referencing capability", () => {
    const graph = buildEventFlowGraph(summary({
      events: [{ label: "PaymentReceived" }],
      capabilities: [
        { name: "CollectPayment", eventDetails: [{ event: "PaymentReceived", label: "PaymentReceived" }] },
        {
          name: "FulfilOrder",
          lifecycle: {
            transitionDetails: [{ from: "AwaitingPayment", to: "ReadyToShip", triggerKind: "event", triggerName: "PaymentReceived" }],
          },
        },
      ],
    }), "PaymentReceived");

    expect(graph?.edges.filter((edge) => edge.label === "emits").map((edge) => edge.source)).toEqual(["capability:collectpayment"]);
    expect(graph?.edges.filter((edge) => edge.label === "references").map((edge) => edge.target)).toEqual(["capability:fulfilorder"]);
  });

  it("renders events with no consumers honestly", () => {
    const graph = buildEventFlowGraph(summary({
      events: [{ label: "AuditLogged" }],
      capabilities: [
        { name: "Audit", eventDetails: [{ event: "AuditLogged", label: "AuditLogged" }] },
      ],
    }), "AuditLogged");

    expect(graph?.edges.map((edge) => edge.kind)).toEqual(["emits"]);
  });

  it("builds all event flows for multiple events", () => {
    const graph = buildEventFlowGraph(summary({
      events: [{ label: "A" }, { label: "B" }],
      capabilities: [
        { name: "One", eventDetails: [{ event: "A", label: "A" }] },
        { name: "Two", eventDetails: [{ event: "B", label: "B" }] },
      ],
    }));

    expect(graph?.nodes.filter((node) => node.kind === "event").map((node) => node.label)).toEqual(["A", "B"]);
    expect(graph?.title).toBe("All Event Flows Graph");
  });

  it("normalises display labels while preserving original event names and ids", () => {
    const graph = buildEventFlowGraph(summary({
      events: [{ label: "customer_registered" }],
      capabilities: [
        { name: "RegisterCustomer", eventDetails: [{ event: "customer_registered", label: "customer_registered" }] },
      ],
    }), "customer_registered");

    expect(graph?.nodes.find((node) => node.kind === "event")).toMatchObject({
      id: "event:customer-registered",
      label: "Customer Registered",
      sourceName: "customer_registered",
    });
    expect(graph?.nodes.find((node) => node.kind === "capability")).toMatchObject({
      id: "capability:registercustomer",
      label: "Register Customer",
      sourceName: "RegisterCustomer",
    });
  });

  it("does not invent source ranges when summary data is unlocated", () => {
    const graph = buildEventFlowGraph(summary({
      events: [{ label: "Unlocated" }],
      capabilities: [
        { name: "Emitter", eventDetails: [{ event: "Unlocated", label: "Unlocated" }] },
      ],
    }), "Unlocated");

    expect(graph?.nodes.every((node) => node.source === undefined)).toBe(true);
  });

  it("handles incomplete compiler summaries without inventing flows", () => {
    expect(buildEventFlowGraph({ capabilities: [] })).toBeUndefined();
    expect(buildEventFlowGraph(summary({ events: [{ label: "DeclaredOnly" }], capabilities: [] }), "DeclaredOnly")?.edges).toEqual([]);
  });
});

function summary(value: Partial<SemanticSummary>): SemanticSummary {
  return {
    capabilities: [],
    ...value,
  };
}
