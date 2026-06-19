import { describe, expect, it } from "vitest";
import { buildArchitectureOverviewGraph } from "../../src/graphs/DclArchitectureOverviewGraphBuilder";
import { buildCapabilityGraph } from "../../src/graphs/DclCapabilityGraphBuilder";
import { buildContextMapGraph } from "../../src/graphs/DclContextMapGraphBuilder";
import { buildEventFlowGraph } from "../../src/graphs/DclEventFlowGraphBuilder";
import { findGraphNodeBySemanticIdentity, semanticIdentity, semanticIdentityEquals } from "../../src/graphs/DclSemanticIdentity";
import { SemanticSummary } from "../../src/views/semanticSummary";

describe("DclSemanticIdentity", () => {
  it("matches semantic identities by kind and source name", () => {
    expect(semanticIdentityEquals(
      { kind: "capability", name: "AcceptOrder" },
      { kind: "capability", name: "AcceptOrder" },
    )).toBe(true);
    expect(semanticIdentityEquals(
      { kind: "capability", name: "AcceptOrder" },
      { kind: "event", name: "AcceptOrder" },
    )).toBe(false);
  });

  it("finds capability nodes across architecture and capability graphs", () => {
    const identity = semanticIdentity("capability", "AcceptOrder");
    const overview = buildArchitectureOverviewGraph(summary({
      contexts: [{ name: "Sales" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales" }],
    }), "overview");
    const capability = buildCapabilityGraph(summary({
      capabilities: [{ name: "AcceptOrder" }],
    }), "AcceptOrder");

    expect(findGraphNodeBySemanticIdentity(overview, identity)?.id).toBe("capability:acceptorder");
    expect(findGraphNodeBySemanticIdentity(capability, identity)?.id).toBe("capability:acceptorder");
  });

  it("finds event nodes across architecture and event flow graphs", () => {
    const identity = semanticIdentity("event", "OrderAccepted");
    const overview = buildArchitectureOverviewGraph(summary({
      capabilities: [{ name: "AcceptOrder", eventDetails: [{ event: "OrderAccepted", label: "OrderAccepted" }] }],
    }), "detailed");
    const eventFlow = buildEventFlowGraph(summary({
      events: [{ label: "OrderAccepted" }],
      capabilities: [{ name: "AcceptOrder", eventDetails: [{ event: "OrderAccepted", label: "OrderAccepted" }] }],
    }), "OrderAccepted");

    expect(findGraphNodeBySemanticIdentity(overview, identity)?.id).toBe("event:orderaccepted");
    expect(findGraphNodeBySemanticIdentity(eventFlow, identity)?.id).toBe("event:orderaccepted");
  });

  it("finds context nodes across architecture and context map graphs", () => {
    const identity = semanticIdentity("context", "Sales");
    const overview = buildArchitectureOverviewGraph(summary({
      contexts: [{ name: "Sales" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales" }],
    }), "overview");
    const contextMap = buildContextMapGraph(summary({
      contexts: [{ name: "Sales" }],
    }));

    expect(findGraphNodeBySemanticIdentity(overview, identity)?.id).toBe("context:sales");
    expect(findGraphNodeBySemanticIdentity(contextMap, identity)?.id).toBe("context:sales");
  });
});

function summary(value: Partial<SemanticSummary>): SemanticSummary {
  return {
    capabilities: [],
    ...value,
  };
}
