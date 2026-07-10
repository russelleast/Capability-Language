import { describe, expect, it } from "vitest";
import { buildCapabilityInfluenceGraph } from "../../src/graphs/DclCapabilityInfluenceGraphBuilder";
import { SemanticSummary } from "../../src/views/semanticSummary";

describe("DclCapabilityInfluenceGraphBuilder", () => {
  it("builds lifecycle influence from subordinate capability outcome to supervising capability", () => {
    const graph = buildCapabilityInfluenceGraph(summary({
      capabilities: [
        { name: "StartJob" },
        {
          name: "JobManagement",
          lifecycle: {
            transitionDetails: [{
              from: "Requested",
              to: "Started",
              triggerKind: "outcome",
              triggerName: "Started",
              sourceCapability: "StartJob",
            }],
          },
        },
      ],
    }));

    expect(graph?.edges).toHaveLength(1);
    expect(graph?.edges[0]).toMatchObject({
      source: "capability:startjob",
      target: "capability:jobmanagement",
      label: "lifecycle",
      score: 5,
    });
  });

  it("builds event influence only from compiler-derived emission and lifecycle trigger facts", () => {
    const graph = buildCapabilityInfluenceGraph(summary({
      capabilities: [
        { name: "AuthorizePayment", eventDetails: [{ event: "PaymentAuthorized", label: "PaymentAuthorized" }] },
        {
          name: "ConfirmOrder",
          lifecycle: {
            transitionDetails: [{
              from: "Pending",
              to: "Confirmed",
              triggerKind: "event",
              triggerName: "PaymentAuthorized",
            }],
          },
        },
      ],
    }));

    expect(graph?.edges[0]).toMatchObject({
      source: "capability:authorizepayment",
      target: "capability:confirmorder",
      label: "event",
      score: 4,
    });
  });

  it("builds explicit capability relation influence", () => {
    const graph = buildCapabilityInfluenceGraph(summary({
      capabilities: [
        { name: "AssessClaim", relations: [{ kind: "depends_on", from: "capability:AssessClaim", to: "capability:SettleClaim" }] },
        { name: "SettleClaim" },
      ],
    }));

    expect(graph?.edges[0]).toMatchObject({
      source: "capability:assessclaim",
      target: "capability:settleclaim",
      label: "relation",
      score: 3,
    });
  });

  it("combines multiple evidence items into one weighted edge", () => {
    const graph = buildCapabilityInfluenceGraph(summary({
      capabilities: [
        {
          name: "CapturePayment",
          eventDetails: [{ event: "PaymentCaptured", label: "PaymentCaptured" }],
          relations: [{ kind: "supports", from: "CapturePayment", to: "FulfilOrder" }],
        },
        {
          name: "FulfilOrder",
          lifecycle: {
            transitionDetails: [{
              from: "Paid",
              to: "Ready",
              triggerKind: "event",
              triggerName: "PaymentCaptured",
            }],
          },
        },
      ],
    }));

    expect(graph?.edges).toHaveLength(1);
    expect(graph?.edges[0].score).toBe(7);
    expect(graph?.edges[0].label).toBe("event");
    expect(graph?.edges[0].reasons?.map((reason) => reason.kind)).toEqual(["event", "relation"]);
  });

  it("does not create an edge for context dependency without a concrete capability reference", () => {
    const graph = buildCapabilityInfluenceGraph(summary({
      dependencies: [{ sourceContext: "Sales", targetContext: "Shared" }],
      capabilities: [
        { name: "AcceptOrder", context: "Sales" },
        { name: "SharedTypes", context: "Shared" },
      ],
    }));

    expect(graph).toBeUndefined();
  });

  it("does not create an edge for shared actor alone", () => {
    const graph = buildCapabilityInfluenceGraph(summary({
      capabilities: [
        { name: "PlaceOrder", actors: ["Customer"] },
        { name: "CancelOrder", actors: ["Customer"] },
      ],
    }));

    expect(graph).toBeUndefined();
  });

  it("returns no graph when no explicit influence exists", () => {
    expect(buildCapabilityInfluenceGraph(summary({
      capabilities: [{ name: "A" }, { name: "B" }],
    }))).toBeUndefined();
  });

  it("preserves source navigation metadata for capability nodes", () => {
    const source = { file: "jobs.dcl", line: 3, column: 1 };
    const graph = buildCapabilityInfluenceGraph(summary({
      capabilities: [
        { name: "StartJob", location: source },
        {
          name: "JobManagement",
          lifecycle: { transitionDetails: [{ from: "Queued", to: "Started", sourceCapability: "StartJob" }] },
        },
      ],
    }));

    expect(graph?.nodes.find((node) => node.id === "capability:startjob")?.source).toEqual(source);
  });

  it("preserves edge evidence details", () => {
    const graph = buildCapabilityInfluenceGraph(summary({
      capabilities: [
        { name: "A", policyDetails: [{ policy: "ConstrainB", targetKind: "capability", targetName: "B" }] },
        { name: "B" },
      ],
    }));

    expect(graph?.edges[0].reasons).toEqual([
      expect.objectContaining({
        kind: "policy",
        score: 2,
        detail: expect.stringContaining("ConstrainB"),
      }),
    ]);
  });
});

function summary(value: Partial<SemanticSummary>): SemanticSummary {
  return {
    capabilities: [],
    ...value,
  };
}
