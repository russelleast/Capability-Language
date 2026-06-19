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
    expect(graph.nodes.find((node) => node.label === "Registration Accepted")?.source?.line).toBe(10);
    expect(graph.nodes.find((node) => node.id === "outcomes:registrationaccepted")).toMatchObject({
      label: "Registration Accepted",
      sourceName: "RegistrationAccepted",
    });
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
    const sourcesByName = new Map(graph.nodes.map((node) => [node.sourceName, node.source]));

    expect(sourcesByName.get("RegisterCustomer")).toEqual({ file: "register.dcl", line: 1, column: 1 });
    expect(sourcesByName.get("RegistrationInput from Customer")).toEqual({ file: "register.dcl", line: 3, column: 7 });
    expect(sourcesByName.get("RegistrationAccepted")).toEqual({ file: "register.dcl", line: 10, column: 5 });
    expect(sourcesByName.get("PersistRegistration")).toEqual({ file: "register.dcl", line: 14, column: 3 });
    expect(sourcesByName.get("VerificationMessageSent")).toEqual({ file: "register.dcl", line: 15, column: 3 });
    expect(sourcesByName.get("RegistrationReliability")).toEqual({ file: "policies.dcl", line: 2, column: 1 });
  });

  it("leaves graph nodes unlocated when the compiler summary has no source metadata", () => {
    const graph = buildCapabilityGraphFromCapability({
      name: "UnlocatedCapability",
      intents: ["UnlocatedIntent"],
    });

    expect(graph.nodes[0]).toMatchObject({
      id: "capability:unlocatedcapability",
      label: "Unlocated Capability",
      sourceName: "UnlocatedCapability",
      kind: "capability",
      source: undefined,
      semanticIdentity: { kind: "capability", name: "UnlocatedCapability" },
    });
    expect(graph.nodes[1]).toMatchObject({
      id: "intents:unlocatedintent",
      label: "Unlocated Intent",
      sourceName: "UnlocatedIntent",
      kind: "intent",
      source: undefined,
    });
  });

  it("selects one capability by name from a semantic summary", () => {
    const summary: SemanticSummary = { capabilities: [capability] };
    expect(buildCapabilityGraph(summary, "RegisterCustomer")?.nodes[0]).toMatchObject({
      id: "capability:registercustomer",
      label: "Register Customer",
      sourceName: "RegisterCustomer",
    });
    expect(buildCapabilityGraph(summary, "Missing")).toBeUndefined();
  });
});
