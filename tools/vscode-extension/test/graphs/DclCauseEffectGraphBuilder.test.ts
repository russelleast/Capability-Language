import { describe, expect, it } from "vitest";
import { buildCauseEffectGraph } from "../../src/graphs/DclCauseEffectGraphBuilder";
import { SemanticSummary } from "../../src/views/semanticSummary";

describe("DclCauseEffectGraphBuilder", () => {
  it("shows intent starts as a distinct non-causal entry edge", () => {
    const graph = buildCauseEffectGraph(summary({
      capabilities: [{
        name: "RegisterCustomer",
        intents: ["RegisterInput from Customer"],
        outcomes: ["Accepted"],
        causation: { outcomeCauses: [{ outcome: "Accepted", sourceKind: "capability", sourceName: "RegisterCustomer", condition: "otherwise", precedence: 0 }] },
      }],
    }), "RegisterCustomer");

    expect(graph?.edges).toContainEqual(expect.objectContaining({
      source: "intent:registerinput-from-customer",
      target: "capability:registercustomer",
      label: "starts",
      kind: "entry",
    }));
    expect(graph?.edges.filter((edge) => edge.kind === "causes-outcome")).toHaveLength(1);
  });

  it("renders rule failure, effect failure, policy denial, and otherwise outcome causes", () => {
    const graph = buildCauseEffectGraph(summary({
      capabilities: [{
        name: "AssessClaim",
        rules: ["AmountSupported"],
        effects: ["RecordPayout"],
        policies: ["ClaimAuthorisation"],
        outcomes: ["ClaimRejected", "PayoutFailed", "AuthorisationDenied", "ClaimApproved"],
        causation: {
          outcomeCauses: [
            { outcome: "ClaimRejected", sourceKind: "rule", sourceName: "AmountSupported", condition: "violated", precedence: 0 },
            { outcome: "PayoutFailed", sourceKind: "effect", sourceName: "RecordPayout", condition: "unresolved", precedence: 1 },
            { outcome: "AuthorisationDenied", sourceKind: "policy", sourceName: "ClaimAuthorisation", condition: "denied", precedence: 2 },
            { outcome: "ClaimApproved", sourceKind: "capability", sourceName: "AssessClaim", condition: "otherwise", precedence: 3 },
          ],
        },
      }],
    }), "AssessClaim");

    expect(graph?.edges.filter((edge) => edge.kind === "causes-outcome").map((edge) => edge.label)).toEqual([
      "fails",
      "failed",
      "denies",
      "otherwise",
    ]);
  });

  it("connects explicit outcome-scoped events and lifecycle movement", () => {
    const graph = buildCauseEffectGraph(summary({
      events: [{ label: "OrderAcceptedEvent" }],
      capabilities: [{
        name: "AcceptOrder",
        outcomes: ["Accepted"],
        eventDetails: [{ event: "OrderAcceptedEvent", label: "OrderAcceptedEvent from Accepted", sourceOutcome: "Accepted" }],
        lifecycle: {
          transitionDetails: [
            { from: "Pending", to: "Accepted", triggerKind: "outcome", triggerName: "Accepted" },
            { from: "Accepted", to: "Completed", triggerKind: "event", triggerName: "OrderAcceptedEvent" },
          ],
        },
        causation: { outcomeCauses: [{ outcome: "Accepted", sourceKind: "capability", sourceName: "AcceptOrder", condition: "otherwise", precedence: 0 }] },
      }],
    }), "AcceptOrder");

    expect(graph?.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "outcome:accepted", target: "event:orderacceptedevent", label: "emits", kind: "emits" }),
      expect.objectContaining({ source: "outcome:accepted", label: "moves lifecycle", kind: "moves-lifecycle" }),
      expect.objectContaining({ source: "event:orderacceptedevent", label: "moves lifecycle", kind: "moves-lifecycle" }),
    ]));
  });

  it("warns instead of inferring event causation from capability-level emits", () => {
    const graph = buildCauseEffectGraph(summary({
      capabilities: [{
        name: "ArchiveBatch",
        outcomes: ["Archived"],
        eventDetails: [{ event: "BatchArchived", label: "BatchArchived" }],
        causation: { outcomeCauses: [{ outcome: "Archived", sourceKind: "capability", sourceName: "ArchiveBatch", condition: "otherwise", precedence: 0 }] },
      }],
    }), "ArchiveBatch");

    expect(graph?.warnings?.[0]).toMatch(/without an explicit outcome source/);
    expect(graph?.edges.some((edge) => edge.target === "event:batcharchived")).toBe(false);
  });

  it("returns no graph when there are no explicit causal relationships", () => {
    expect(buildCauseEffectGraph(summary({
      capabilities: [{ name: "Empty", intents: ["Input from User"] }],
    }), "Empty")).toBeUndefined();
  });
});

function summary(value: Partial<SemanticSummary>): SemanticSummary {
  return {
    capabilities: [],
    ...value,
  };
}
