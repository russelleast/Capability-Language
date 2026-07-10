import { describe, expect, it } from "vitest";
import { displayNameForGraph, graphSourceName, wrapGraphLabel } from "../../src/graphs/DclGraphLabels";

describe("DclGraphLabels", () => {
  it.each([
    ["CapturePayment", "Capture Payment"],
    ["ReserveInventory", "Reserve Inventory"],
    ["fulfil_order", "Fulfil Order"],
    ["customer_registered", "Customer Registered"],
    ["fulfil-order", "Fulfil Order"],
    ["Customer.Registration", "Customer / Registration"],
    ["Already Spaced", "Already Spaced"],
    ["APIRequest", "API Request"],
    ["HTTPCallback", "HTTP Callback"],
  ])("normalises %s", (input, expected) => {
    expect(displayNameForGraph(input)).toBe(expected);
  });

  it("wraps PascalCase display labels on word boundaries", () => {
    expect(wrapGraphLabel("ManageOrderFulfilment", 12).map((line) => line.text)).toEqual([
      "Manage Order",
      "Fulfilment",
    ]);
  });

  it("wraps whitespace-separated labels without splitting ordinary words", () => {
    expect(wrapGraphLabel("Manage Order Fulfilment", 12).map((line) => line.text)).toEqual([
      "Manage Order",
      "Fulfilment",
    ]);
  });

  it("splits only individual words longer than the maximum line width", () => {
    expect(wrapGraphLabel("Supercalifragilistic", 8).map((line) => line.text)).toEqual([
      "Supercal",
      "ifragili",
      "stic",
    ]);
  });

  it("preserves practical acronyms in display labels", () => {
    expect(wrapGraphLabel("HTTPAPIRequest", 12).map((line) => line.text)).toEqual([
      "HTTPAPI",
      "Request",
    ]);
  });

  it("keeps the original source name unchanged", () => {
    expect(graphSourceName("ManageOrderFulfilment")).toBe("ManageOrderFulfilment");
  });
});
