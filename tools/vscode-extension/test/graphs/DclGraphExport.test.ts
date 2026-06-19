import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { graphExportBaseName, graphExportFilename } from "../../src/graphs/DclGraphExport";
import { ALL_CONTEXTS, ALL_EVENT_FLOWS } from "../../src/graphs/DclGraphWorkspaceState";

describe("DclGraphExport", () => {
  it.each([
    ["architecture", undefined, "dcl-architecture-overview"],
    ["capability", "PlaceOrder", "dcl-capability-place-order"],
    ["lifecycle", "OrderFulfilment", "dcl-lifecycle-order-fulfilment"],
    ["event-flow", "OrderSubmitted", "dcl-event-flow-order-submitted"],
    ["event-flow", ALL_EVENT_FLOWS, "dcl-event-flow-all-events"],
    ["context-map", "Customer.Registration", "dcl-context-map-customer-registration"],
    ["context-map", ALL_CONTEXTS, "dcl-context-map-all-contexts"],
  ] as const)("maps %s %s to %s", (graphType, subject, expected) => {
    expect(graphExportBaseName(graphType, subject)).toBe(expected);
  });

  it("adds the requested export extension", () => {
    expect(graphExportFilename("capability", "PlaceOrder", "svg")).toBe("dcl-capability-place-order.svg");
    expect(graphExportFilename("capability", "PlaceOrder", "png")).toBe("dcl-capability-place-order.png");
  });

  it("contributes the export command", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "../../package.json"), "utf8"));
    expect(packageJson.activationEvents).toContain("onCommand:dcl.exportCurrentGraph");
    expect(packageJson.contributes.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "dcl.exportCurrentGraph",
          title: "DCL: Export Current Graph",
        }),
      ]),
    );
  });
});
