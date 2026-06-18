import { describe, expect, it } from "vitest";
import { displayNameForGraph } from "../../src/graphs/DclGraphLabels";

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
});
