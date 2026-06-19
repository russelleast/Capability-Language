import { describe, expect, it } from "vitest";
import {
  buildSemanticNavigationItems,
  findSemanticNavigationItem,
  relatedSemanticItems,
  semanticInspectorText,
  semanticItemMatchesQuery,
} from "../../src/navigation/DclSemanticNavigation";
import { SemanticSummary } from "../../src/views/semanticSummary";

describe("DclSemanticNavigation", () => {
  it("builds searchable symbols for workspace semantic items", () => {
    const items = buildSemanticNavigationItems(summary());

    expect(items.map((item) => item.label)).toEqual(expect.arrayContaining([
      "Context: Payments",
      "Capability: Process Payment",
      "Event: Payment Captured",
      "Effect: Persist Payment",
      "Policy: Safe Retry",
      "Actor: Customer",
      "Lifecycle: Process Payment",
      "Lifecycle Step: Captured",
    ]));
  });

  it("supports fuzzy matching against category and display labels", () => {
    const capability = buildSemanticNavigationItems(summary()).find((item) => item.name === "ProcessPayment");

    expect(capability).toBeDefined();
    expect(semanticItemMatchesQuery(capability!, "cap pay")).toBe(true);
    expect(semanticItemMatchesQuery(capability!, "zzz")).toBe(false);
  });

  it("discovers elements related to a capability", () => {
    const semanticSummary = summary();
    const capability = buildSemanticNavigationItems(semanticSummary).find((item) => item.kind === "capability" && item.name === "ProcessPayment");

    const related = relatedSemanticItems(semanticSummary, capability!);

    expect(related.map((item) => item.label)).toEqual(expect.arrayContaining([
      "Event: Payment Captured",
      "Effect: Persist Payment",
      "Policy: Safe Retry",
      "Lifecycle: Process Payment",
      "Lifecycle Step: Captured",
    ]));
  });

  it("discovers event emitters and lifecycle references", () => {
    const semanticSummary = summary();
    const event = buildSemanticNavigationItems(semanticSummary).find((item) => item.kind === "event" && item.name === "PaymentCaptured");

    const related = relatedSemanticItems(semanticSummary, event!);

    expect(related.map((item) => item.label)).toEqual(expect.arrayContaining([
      "Capability: Process Payment",
      "Lifecycle Transition: Started > Captured On Event Payment Captured",
    ]));
  });

  it("discovers context capabilities and dependencies", () => {
    const semanticSummary = summary();
    const context = buildSemanticNavigationItems(semanticSummary).find((item) => item.kind === "context" && item.name === "Payments");

    const related = relatedSemanticItems(semanticSummary, context!);

    expect(related.map((item) => item.label)).toEqual(expect.arrayContaining([
      "Capability: Process Payment",
      "Context: Shared",
    ]));
  });

  it("keeps source and graph identity for navigation integration", () => {
    const items = buildSemanticNavigationItems(summary());
    const event = findSemanticNavigationItem(items, { kind: "event", name: "PaymentCaptured" });

    expect(event?.source).toEqual({ file: "payments.dcl", line: 10, column: 3 });
    expect(event?.identity).toEqual({ kind: "event", name: "PaymentCaptured" });
    expect(event?.graphAvailable).toBe(true);
  });

  it("formats semantic inspector details", () => {
    const item = buildSemanticNavigationItems(summary()).find((candidate) => candidate.kind === "policy" && candidate.name === "SafeRetry");

    expect(semanticInspectorText(item!)).toContain("Symbol: SafeRetry");
    expect(semanticInspectorText(item!)).toContain("Type: Policy");
    expect(semanticInspectorText(item!)).toContain("Graph: available");
  });
});

function summary(): SemanticSummary {
  return {
    contexts: [
      { name: "Payments", dependencies: ["Shared"], location: { file: "payments.dcl", line: 1, column: 1 } },
      { name: "Shared", location: { file: "shared.dcl", line: 1, column: 1 } },
    ],
    actors: [{ label: "Customer", location: { file: "actors.dcl", line: 1, column: 1 } }],
    events: [{ label: "PaymentCaptured", location: { file: "payments.dcl", line: 10, column: 3 } }],
    effects: [{ label: "PersistPayment", location: { file: "payments.dcl", line: 11, column: 3 } }],
    policies: [{ label: "SafeRetry", location: { file: "payments.dcl", line: 12, column: 3 } }],
    capabilities: [{
      name: "ProcessPayment",
      context: "Payments",
      location: { file: "payments.dcl", line: 3, column: 1 },
      intents: ["PaymentRequest"],
      outcomes: ["Captured"],
      eventDetails: [{ event: "PaymentCaptured", label: "PaymentCaptured" }],
      events: ["PaymentCaptured"],
      effects: ["PersistPayment"],
      policies: ["SafeRetry"],
      lifecycle: {
        begin: "Started",
        ends: ["Captured"],
        stepDetails: [{ name: "Captured", isTerminal: true }],
        transitionDetails: [{ from: "Started", to: "Captured", triggerKind: "event", triggerName: "PaymentCaptured" }],
      },
      itemLocations: {
        events: { PaymentCaptured: { file: "payments.dcl", line: 10, column: 3 } },
        effects: { PersistPayment: { file: "payments.dcl", line: 11, column: 3 } },
        policies: { SafeRetry: { file: "payments.dcl", line: 12, column: 3 } },
        lifecycle: {
          "begin Started": { file: "payments.dcl", line: 14, column: 3 },
          Captured: { file: "payments.dcl", line: 15, column: 3 },
          "Started -> Captured on event PaymentCaptured": { file: "payments.dcl", line: 16, column: 3 },
        },
      },
    }],
  };
}
