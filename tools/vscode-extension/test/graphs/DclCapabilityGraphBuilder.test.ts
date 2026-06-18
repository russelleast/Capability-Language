import { describe, expect, it } from "vitest";
import { buildCapabilityGraph, buildCapabilityGraphFromCapability } from "../../src/graphs/DclCapabilityGraphBuilder";
import { CapabilitySummary, SemanticSummary } from "../../src/views/semanticSummary";

describe("DclCapabilityGraphBuilder", () => {
  const capability: CapabilitySummary = {
    name: "RegisterCustomer",
    location: { file: "register.dcl", line: 1, column: 1 },
    intents: ["RegistrationInput from Customer"],
    outcomes: ["RegistrationAccepted"],
    rules: ["TermsAccepted"],
    effects: ["PersistRegistration"],
    events: ["VerificationMessageSent"],
    policies: ["RegistrationReliability"],
    lifecycle: { begin: "Pending", ends: ["Verified"], steps: ["Pending"] },
    itemLocations: {
      intents: {
        "RegistrationInput from Customer": { file: "register.dcl", line: 3, column: 7 },
      },
      outcomes: {
        RegistrationAccepted: { file: "register.dcl", line: 10, column: 5 },
      },
      effects: {
        PersistRegistration: { file: "register.dcl", line: 14, column: 3 },
      },
      events: {
        VerificationMessageSent: { file: "register.dcl", line: 15, column: 3 },
      },
      policies: {
        RegistrationReliability: { file: "policies.dcl", line: 2, column: 1 },
      },
    },
  };

  it("builds a capability-centered graph with semantic nodes and labelled relationships", () => {
    const graph = buildCapabilityGraphFromCapability(capability);

    expect(graph.title).toBe("RegisterCustomer Capability Graph");
    expect(graph.nodes.map((node) => node.kind)).toEqual([
      "capability",
      "intent",
      "outcome",
      "rule",
      "effect",
      "event",
      "policy",
      "lifecycle",
    ]);
    expect(graph.edges.map((edge) => edge.label)).toEqual([
      "accepts",
      "produces",
      "enforces",
      "causes",
      "emits",
      "governed by",
      "owns",
    ]);
    expect(graph.nodes.find((node) => node.label === "RegistrationAccepted")?.source?.line).toBe(10);
  });

  it("keeps optional node categories out of the graph when absent", () => {
    const graph = buildCapabilityGraphFromCapability({
      name: "MinimalCapability",
      outcomes: ["Accepted"],
    });

    expect(graph.nodes.map((node) => node.kind)).toEqual(["capability", "outcome"]);
    expect(graph.edges.map((edge) => edge.label)).toEqual(["produces"]);
  });

  it("adds source metadata to graph nodes when the semantic summary provides it", () => {
    const graph = buildCapabilityGraphFromCapability(capability);
    const sourcesByLabel = new Map(graph.nodes.map((node) => [node.label, node.source]));

    expect(sourcesByLabel.get("RegisterCustomer")).toEqual({ file: "register.dcl", line: 1, column: 1 });
    expect(sourcesByLabel.get("RegistrationInput from Customer")).toEqual({ file: "register.dcl", line: 3, column: 7 });
    expect(sourcesByLabel.get("RegistrationAccepted")).toEqual({ file: "register.dcl", line: 10, column: 5 });
    expect(sourcesByLabel.get("PersistRegistration")).toEqual({ file: "register.dcl", line: 14, column: 3 });
    expect(sourcesByLabel.get("VerificationMessageSent")).toEqual({ file: "register.dcl", line: 15, column: 3 });
    expect(sourcesByLabel.get("RegistrationReliability")).toEqual({ file: "policies.dcl", line: 2, column: 1 });
  });

  it("leaves graph nodes unlocated when the compiler summary has no source metadata", () => {
    const graph = buildCapabilityGraphFromCapability({
      name: "UnlocatedCapability",
      intents: ["UnlocatedIntent"],
    });

    expect(graph.nodes).toEqual([
      { id: "capability:unlocatedcapability", label: "UnlocatedCapability", kind: "capability", source: undefined },
      { id: "intents:unlocatedintent", label: "UnlocatedIntent", kind: "intent", source: undefined },
    ]);
  });

  it("selects one capability by name from a semantic summary", () => {
    const summary: SemanticSummary = { capabilities: [capability] };
    expect(buildCapabilityGraph(summary, "RegisterCustomer")?.nodes[0].label).toBe("RegisterCustomer");
    expect(buildCapabilityGraph(summary, "Missing")).toBeUndefined();
  });
});
