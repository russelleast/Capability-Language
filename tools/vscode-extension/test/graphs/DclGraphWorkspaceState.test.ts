import { describe, expect, it } from "vitest";
import { ALL_CONTEXTS, ALL_EVENT_FLOWS, buildGraphWorkspaceState } from "../../src/graphs/DclGraphWorkspaceState";
import { SemanticSummary } from "../../src/views/semanticSummary";

describe("DclGraphWorkspaceState", () => {
  it("opens architecture overview by default without a subject", () => {
    const state = buildGraphWorkspaceState(summary({
      contexts: [{ name: "Sales" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales" }],
    }));

    expect(state.graphType).toBe("architecture");
    expect(state.subject).toBeUndefined();
    expect(state.graph?.title).toBe("DCL Architecture Overview");
    expect(state.exportBaseName).toBe("dcl-architecture-overview");
  });

  it("selects the first capability when capability graph has no subject", () => {
    const state = buildGraphWorkspaceState(summary({
      capabilities: [{ name: "AcceptOrder" }, { name: "ShipOrder" }],
    }), { graphType: "capability" });

    expect(state.subject).toBe("AcceptOrder");
    expect(state.exportBaseName).toBe("dcl-capability-accept-order");
    expect(state.subjects.map((subject) => subject.value)).toEqual(["AcceptOrder", "ShipOrder"]);
    expect(state.graph?.nodes[0]).toMatchObject({ id: "capability:acceptorder" });
  });

  it("only offers lifecycle subjects with lifecycle data", () => {
    const state = buildGraphWorkspaceState(summary({
      capabilities: [
        { name: "AcceptOrder" },
        { name: "ShipOrder", lifecycle: { begin: "Started" } },
      ],
    }), { graphType: "lifecycle" });

    expect(state.subjects.map((subject) => subject.value)).toEqual(["ShipOrder"]);
    expect(state.subject).toBe("ShipOrder");
  });

  it("offers all event flows plus individual events", () => {
    const state = buildGraphWorkspaceState(summary({
      events: [{ label: "PaymentReceived" }],
      capabilities: [{ name: "CollectPayment", eventDetails: [{ event: "PaymentReceived", label: "PaymentReceived" }] }],
    }), { graphType: "event-flow" });

    expect(state.subjects.map((subject) => subject.value)).toEqual([ALL_EVENT_FLOWS, "PaymentReceived"]);
    expect(state.subject).toBe(ALL_EVENT_FLOWS);
  });

  it("offers all contexts plus individual contexts", () => {
    const state = buildGraphWorkspaceState(summary({
      contexts: [{ name: "Sales" }, { name: "Shared" }],
    }), { graphType: "context-map" });

    expect(state.subjects.map((subject) => subject.value)).toEqual([ALL_CONTEXTS, "Sales", "Shared"]);
    expect(state.subject).toBe(ALL_CONTEXTS);
  });

  it("returns friendly empty state when selected graph has no data", () => {
    const state = buildGraphWorkspaceState(summary({
      capabilities: [],
    }), { graphType: "event-flow" });

    expect(state.graph).toBeUndefined();
    expect(state.emptyTitle).toBe("No Events Declared");
  });
});

function summary(value: Partial<SemanticSummary>): SemanticSummary {
  return {
    capabilities: [],
    ...value,
  };
}
