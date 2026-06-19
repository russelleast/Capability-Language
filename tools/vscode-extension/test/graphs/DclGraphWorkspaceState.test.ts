import { describe, expect, it } from "vitest";
import { ALL_CONTEXTS, ALL_EVENT_FLOWS, buildGraphWorkspaceState, graphSyncTargetsForIdentity } from "../../src/graphs/DclGraphWorkspaceState";
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

  it("does not offer empty synthetic default contexts", () => {
    const state = buildGraphWorkspaceState(summary({
      contexts: [{ name: "default" }, { name: "Sales" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales" }],
    }), { graphType: "context-map" });

    expect(state.subjects.map((subject) => subject.value)).toEqual([ALL_CONTEXTS, "Sales"]);
  });

  it("offers Workspace fallback only when declarations have no context", () => {
    const state = buildGraphWorkspaceState(summary({
      contexts: [{ name: "default" }, { name: "Workspace" }, { name: "Uncontexted" }],
      capabilities: [{ name: "AcceptOrder" }],
    }), { graphType: "context-map" });

    expect(state.subjects.map((subject) => subject.value)).toEqual([ALL_CONTEXTS, "Workspace"]);
  });

  it("returns friendly empty state when selected graph has no data", () => {
    const state = buildGraphWorkspaceState(summary({
      capabilities: [],
    }), { graphType: "event-flow" });

    expect(state.graph).toBeUndefined();
    expect(state.emptyTitle).toBe("No Events Declared");
  });

  it("offers graph sync from architecture capability nodes to capability graph", () => {
    const state = buildGraphWorkspaceState(summary({
      contexts: [{ name: "Sales" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales" }],
    }), { graphType: "architecture" });
    const capability = state.graph?.nodes.find((node) => node.semanticIdentity?.kind === "capability");

    expect(capability).toBeDefined();
    expect(state.graphSyncTargets[capability!.id]).toContainEqual(expect.objectContaining({
      label: "Show in Capability Graph",
      graphType: "capability",
      subject: "AcceptOrder",
      focusIdentity: { kind: "capability", name: "AcceptOrder" },
    }));
    expect(state.graphSyncTargets[capability!.id].some((target) => target.graphType === "architecture")).toBe(false);
  });

  it("offers graph sync from event nodes to event flow graph", () => {
    const state = buildGraphWorkspaceState(summary({
      events: [{ label: "OrderSubmitted" }],
      capabilities: [{ name: "AcceptOrder", eventDetails: [{ event: "OrderSubmitted", label: "OrderSubmitted" }] }],
    }), { graphType: "architecture", architectureDetailLevel: "detailed" });
    const event = state.graph?.nodes.find((node) => node.semanticIdentity?.kind === "event");

    expect(event).toBeDefined();
    expect(state.graphSyncTargets[event!.id]).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Show in Event Flow Graph",
        graphType: "event-flow",
        subject: "OrderSubmitted",
        focusIdentity: { kind: "event", name: "OrderSubmitted" },
      }),
    ]));
  });

  it("offers graph sync from context nodes to context map", () => {
    const state = buildGraphWorkspaceState(summary({
      contexts: [{ name: "Sales" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales" }],
    }), { graphType: "architecture" });
    const context = state.graph?.nodes.find((node) => node.semanticIdentity?.kind === "context");

    expect(context).toBeDefined();
    expect(state.graphSyncTargets[context!.id]).toContainEqual(expect.objectContaining({
      label: "Show in Context Map",
      graphType: "context-map",
      subject: "Sales",
      focusIdentity: { kind: "context", name: "Sales" },
    }));
  });

  it("offers graph sync from lifecycle nodes to capability and lifecycle graphs", () => {
    const targets = graphSyncTargetsForIdentity(summary({
      capabilities: [{
        name: "FulfilOrder",
        lifecycle: {
          begin: "Received",
          steps: ["Received"],
        },
      }],
    }), { kind: "lifecycle", name: "FulfilOrder" }, "architecture");

    expect(targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Show in Capability Graph", graphType: "capability", subject: "FulfilOrder" }),
      expect.objectContaining({ label: "Show in Lifecycle Graph", graphType: "lifecycle", subject: "FulfilOrder" }),
    ]));
    expect(targets.some((target) => target.graphType === "architecture")).toBe(false);
  });

  it("does not offer graph sync targets that cannot represent the identity", () => {
    const targets = graphSyncTargetsForIdentity(summary({
      capabilities: [{ name: "AcceptOrder" }],
    }), { kind: "event", name: "MissingEvent" });

    expect(targets).toEqual([]);
  });
});

function summary(value: Partial<SemanticSummary>): SemanticSummary {
  return {
    capabilities: [],
    ...value,
  };
}
