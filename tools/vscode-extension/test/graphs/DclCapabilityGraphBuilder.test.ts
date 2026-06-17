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
      outcomes: {
        RegistrationAccepted: { file: "register.dcl", line: 10, column: 5 },
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
      "accepts intent",
      "produces outcome",
      "enforces rule",
      "causes effect",
      "emits event",
      "governed by policy",
      "owns lifecycle",
    ]);
    expect(graph.nodes.find((node) => node.label === "RegistrationAccepted")?.source?.line).toBe(10);
  });

  it("selects one capability by name from a semantic summary", () => {
    const summary: SemanticSummary = { capabilities: [capability] };
    expect(buildCapabilityGraph(summary, "RegisterCustomer")?.nodes[0].label).toBe("RegisterCustomer");
    expect(buildCapabilityGraph(summary, "Missing")).toBeUndefined();
  });
});
