import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { summarizeCompilerOutput } from "../../src/views/semanticSummary";

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "../../test-fixtures/compiler-output", name), "utf8"));

describe("semantic summary normalization", () => {
  it("normalizes capabilities and capability children", () => {
    const summary = summarizeCompilerOutput(fixture("relative-source-location.json"));
    expect(summary.capabilities[0].name).toBe("RelativeLocationCapability");
    expect(summary.capabilities[0].events).toEqual(["BatchArchived"]);
    expect(summary.capabilities[0].itemLocations?.events?.BatchArchived?.file).toContain("valid-summary.dcl");
  });

  it("normalizes top-level semantic groups", () => {
    const summary = summarizeCompilerOutput({
      contexts: [{ name: "Sales" }],
      actors: [{ name: "Customer" }],
      policies: [{ name: "Audit" }],
      effects: [{ name: "PersistOrder" }],
      events: [{ name: "OrderAccepted" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales", lifecycle: { name: "AcceptOrder" } }],
    });

    expect(summary.contexts?.map((item) => item.name)).toEqual(["Sales"]);
    expect(summary.actors?.map((item) => item.label)).toEqual(["Customer"]);
    expect(summary.policies?.map((item) => item.label)).toEqual(["Audit"]);
    expect(summary.effects?.map((item) => item.label)).toEqual(["PersistOrder"]);
    expect(summary.events?.map((item) => item.label)).toEqual(["OrderAccepted"]);
    expect(summary.lifecycles?.map((item) => item.label)).toEqual(["AcceptOrder"]);
  });

  it("normalizes compiler outcome causation from capability analysis", () => {
    const summary = summarizeCompilerOutput({
      capabilities: [{
        name: "AcceptOrder",
        analysis: {
          outcome_causes: [
            { outcome: "Rejected", source: "rule:TermsAccepted", condition: "violated", precedence: 0 },
            { outcome: "Accepted", source: "capability:AcceptOrder", condition: "otherwise", precedence: 1 },
          ],
        },
      }],
    });

    expect(summary.capabilities[0].causation?.outcomeCauses).toEqual([
      { outcome: "Rejected", sourceKind: "rule", sourceName: "TermsAccepted", condition: "violated", precedence: 0 },
      { outcome: "Accepted", sourceKind: "capability", sourceName: "AcceptOrder", condition: "otherwise", precedence: 1 },
    ]);
  });

  it("preserves semantic influence evidence fields", () => {
    const summary = summarizeCompilerOutput({
      dependencies: [{
        source_context: "Sales",
        target_context: "Shared",
        referenced_symbols: ["Shared.AuthorizePayment"],
      }],
      effective_policies: [{
        containing_capability: "PlaceOrder",
        applied_policies: ["PaymentConstraint"],
        target_kind: "capability",
        target_symbol: "AuthorizePayment",
      }],
      capabilities: [{
        name: "PlaceOrder",
        effects: [{ effect: "ReserveStock", target_kind: "capability", target_name: "AllocateStock" }],
        policies: [{ policy: "OrderPolicy", target_kind: "capability", target_name: "AuthorizePayment" }],
        lifecycle: {
          participating_capabilities: ["AuthorizePayment"],
          contributors: [{ capability: "AllocateStock", used_by_transitions: ["Requested -> Allocated"] }],
        },
        relations: [{ kind: "depends_on", from: "PlaceOrder", to: "AuthorizePayment", condition: "required" }],
      }],
    });

    expect(summary.dependencies).toEqual([{
      sourceContext: "Sales",
      targetContext: "Shared",
      referencedSymbols: ["Shared.AuthorizePayment"],
    }]);
    expect(summary.capabilities[0].effectDetails).toEqual([{
      effect: "ReserveStock",
      targetKind: "capability",
      targetName: "AllocateStock",
    }]);
    expect(summary.capabilities[0].policyDetails).toEqual([
      { policy: "OrderPolicy", targetKind: "capability", targetName: "AuthorizePayment" },
      { policy: "PaymentConstraint", targetKind: "capability", targetName: "AuthorizePayment" },
    ]);
    expect(summary.capabilities[0].lifecycle?.participatingCapabilities).toEqual(["AuthorizePayment"]);
    expect(summary.capabilities[0].lifecycle?.contributors).toEqual([{
      capability: "AllocateStock",
      usedByTransitions: ["Requested -> Allocated"],
    }]);
    expect(summary.capabilities[0].relations).toEqual([{
      kind: "depends_on",
      from: "PlaceOrder",
      to: "AuthorizePayment",
      condition: "required",
    }]);
  });

  it("normalizes compiler diagnostics for semantic visual metadata", () => {
    const summary = summarizeCompilerOutput({
      diagnostics: [{
        code: "DCL_SEM_WARNING",
        severity: "warning",
        message: "Ambiguous analysis warning",
        node: "AssessClaim",
        span: { file: "claims.dcl", line: 4, column: 2 },
      }],
      capabilities: [{ name: "AssessClaim" }],
    });

    expect(summary.diagnostics).toEqual([{
      code: "DCL_SEM_WARNING",
      severity: "warning",
      message: "Ambiguous analysis warning",
      node: "AssessClaim",
      location: { file: "claims.dcl", line: 4, column: 2, indexBase: "oneBased" },
    }]);
  });

  it("handles missing optional arrays and invalid summary shapes", () => {
    expect(summarizeCompilerOutput({}).capabilities).toEqual([]);
    const summary = summarizeCompilerOutput(fixture("invalid-summary-shape.json"));
    expect(summary.capabilities).toEqual([]);
    expect(summary.actors?.map((item) => item.label)).toEqual(["StillDefensive"]);
  });

  it("hides empty default contexts when all capabilities belong to explicit contexts", () => {
    const summary = summarizeCompilerOutput({
      contexts: [{ name: "default" }, { name: "Sales" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales" }],
    });

    expect(summary.contexts?.map((context) => context.name)).toEqual(["Sales"]);
  });

  it("uses one Workspace fallback for declarations without context", () => {
    const summary = summarizeCompilerOutput({
      capabilities: [{ name: "AcceptOrder" }, { name: "ShipOrder" }],
    });

    expect(summary.contexts?.map((context) => context.name)).toEqual(["Workspace"]);
  });

  it("hides empty default context even when the compiler returns it", () => {
    const summary = summarizeCompilerOutput({
      contexts: [{ name: "default" }],
      capabilities: [],
    });

    expect(summary.contexts).toBeUndefined();
  });

  it("shows default context when it owns declarations", () => {
    const summary = summarizeCompilerOutput({
      contexts: [{ name: "default" }],
      capabilities: [{ name: "AcceptOrder", context: "default" }],
    });

    expect(summary.contexts?.map((context) => context.name)).toEqual(["default"]);
  });

  it("does not duplicate default, Workspace, or Uncontexted fallback contexts", () => {
    const summary = summarizeCompilerOutput({
      contexts: [{ name: "default" }, { name: "Workspace" }, { name: "Uncontexted" }],
      capabilities: [{ name: "AcceptOrder" }],
    });

    expect(summary.contexts?.map((context) => context.name)).toEqual(["Workspace"]);
  });
});
