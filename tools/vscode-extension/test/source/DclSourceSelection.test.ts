import { describe, expect, it } from "vitest";
import { Position, Uri } from "vscode";
import { semanticIdentityAtSourcePosition } from "../../src/source/DclSourceSelection";
import { SemanticSummary } from "../../src/views/semanticSummary";

const uri = Uri.file("/workspace/order.dcl");

describe("DclSourceSelection", () => {
  it("matches capability containers from compiler source locations", () => {
    const summary = semanticSummary({
      capabilities: [
        { name: "PlaceOrder", location: { file: "/workspace/order.dcl", line: 1, column: 1 } },
        { name: "ShipOrder", location: { file: "/workspace/order.dcl", line: 20, column: 1 } },
      ],
    });

    expect(semanticIdentityAtSourcePosition(summary, uri, new Position(4, 2))).toEqual({
      kind: "capability",
      name: "PlaceOrder",
    });
  });

  it("picks the most specific semantic item when ranges overlap", () => {
    const summary = semanticSummary({
      capabilities: [{
        name: "PlaceOrder",
        location: { file: "/workspace/order.dcl", line: 1, column: 1, endLine: 30, endColumn: 1 },
        itemLocations: {
          events: {
            "OrderSubmitted": { file: "/workspace/order.dcl", line: 10, column: 5, endLine: 10, endColumn: 28 },
          },
        },
      }],
    });

    expect(semanticIdentityAtSourcePosition(summary, uri, new Position(9, 10))).toEqual({
      kind: "event",
      name: "OrderSubmitted",
    });
  });

  it("matches context, effect, and policy source locations", () => {
    const summary = semanticSummary({
      contexts: [{ name: "Sales", location: { file: "/workspace/order.dcl", line: 1, column: 1, endLine: 3, endColumn: 1 } }],
      effects: [{ label: "PersistOrder", location: { file: "/workspace/order.dcl", line: 6, column: 1, endLine: 7, endColumn: 1 } }],
      policies: [{ label: "AuditPolicy", location: { file: "/workspace/order.dcl", line: 9, column: 1, endLine: 10, endColumn: 1 } }],
    });

    expect(semanticIdentityAtSourcePosition(summary, uri, new Position(0, 2))).toEqual({ kind: "context", name: "Sales" });
    expect(semanticIdentityAtSourcePosition(summary, uri, new Position(5, 2))).toEqual({ kind: "effect", name: "PersistOrder" });
    expect(semanticIdentityAtSourcePosition(summary, uri, new Position(8, 2))).toEqual({ kind: "policy", name: "AuditPolicy" });
  });

  it("matches lifecycle steps and transitions when compiler locations exist", () => {
    const summary = semanticSummary({
      capabilities: [{
        name: "FulfilOrder",
        lifecycle: { begin: "Requested", transitions: ["Requested -> Accepted on event OrderAccepted"] },
        itemLocations: {
          lifecycle: {
            "begin Requested": { file: "/workspace/order.dcl", line: 12, column: 3, endLine: 12, endColumn: 20 },
            "Requested -> Accepted on event OrderAccepted": { file: "/workspace/order.dcl", line: 13, column: 3, endLine: 13, endColumn: 48 },
          },
        },
      }],
    });

    expect(semanticIdentityAtSourcePosition(summary, uri, new Position(11, 8))).toEqual({
      kind: "lifecycle-step",
      name: "Requested",
    });
    expect(semanticIdentityAtSourcePosition(summary, uri, new Position(12, 20))).toEqual({
      kind: "lifecycle-transition",
      name: "Requested -> Accepted on event OrderAccepted",
    });
  });

  it("returns undefined when no compiler source range matches", () => {
    expect(semanticIdentityAtSourcePosition(semanticSummary({}), uri, new Position(100, 1))).toBeUndefined();
  });
});

function semanticSummary(value: Partial<SemanticSummary>): SemanticSummary {
  return {
    capabilities: [],
    ...value,
  };
}
