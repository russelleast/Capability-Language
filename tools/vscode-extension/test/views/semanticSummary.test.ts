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
