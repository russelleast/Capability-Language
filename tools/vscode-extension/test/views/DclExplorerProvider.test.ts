import { describe, expect, it } from "vitest";
import { DclExplorerProvider } from "../../src/views/DclExplorerProvider";

async function rootLabels(provider: DclExplorerProvider): Promise<string[]> {
  const children = await provider.getChildren();
  return (children ?? []).map((item) => String(item.label));
}

describe("DclExplorerProvider", () => {
  it("shows an empty state before compilation", async () => {
    const provider = new DclExplorerProvider();
    expect((await rootLabels(provider))[0]).toMatch(/No compiled summary yet/);
  });

  it("shows compile failed and compiler unavailable states", async () => {
    const provider = new DclExplorerProvider();
    provider.showCompileFailed();
    expect((await rootLabels(provider))[0]).toMatch(/Compile failed/);

    provider.showCompilerUnavailable();
    expect((await rootLabels(provider))[0]).toMatch(/compiler unavailable/i);
  });

  it("builds a capability-first populated tree", async () => {
    const provider = new DclExplorerProvider();
    provider.refresh({
      capabilities: [
        {
          name: "AcceptOrder",
          intents: [{ input_shape: "OrderInput", actor: "Customer" }],
          outcomes: [{ name: "Accepted" }],
          invariants: [{ name: "HasOrderId" }],
          effects: [{ effect: "PersistOrder" }],
          emitted_events: [{ event: "OrderAccepted" }],
          policies: [{ policy: "AuditPolicy", target_kind: "capability", target_name: "AcceptOrder" }],
          lifecycle: { initial_state: "Started", terminal_states: ["Done"], steps: [{ name: "Started" }] },
        },
      ],
    });

    const roots = await provider.getChildren();
    expect(roots?.map((item) => item.label)).toContain("Capabilities");
    const capabilities = roots?.find((item) => item.label === "Capabilities");
    const capability = capabilities?.children[0];
    expect(capability?.label).toBe("AcceptOrder");
    expect(capability?.children.map((item) => item.label)).toEqual([
      "Intents",
      "Outcomes",
      "Rules",
      "Effects",
      "Events",
      "Policies",
      "Lifecycle",
    ]);
  });
});
