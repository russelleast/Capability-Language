"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const DclExplorerProvider_1 = require("../../src/views/DclExplorerProvider");
async function rootLabels(provider) {
    const children = await provider.getChildren();
    return (children ?? []).map((item) => String(item.label));
}
(0, vitest_1.describe)("DclExplorerProvider", () => {
    (0, vitest_1.it)("shows an empty state before compilation", async () => {
        const provider = new DclExplorerProvider_1.DclExplorerProvider();
        (0, vitest_1.expect)((await rootLabels(provider))[0]).toMatch(/No compiled summary yet/);
    });
    (0, vitest_1.it)("shows compile failed and compiler unavailable states", async () => {
        const provider = new DclExplorerProvider_1.DclExplorerProvider();
        provider.showCompileFailed();
        (0, vitest_1.expect)((await rootLabels(provider))[0]).toMatch(/Compile failed/);
        provider.showCompilerUnavailable();
        (0, vitest_1.expect)((await rootLabels(provider))[0]).toMatch(/compiler unavailable/i);
    });
    (0, vitest_1.it)("builds a capability-first populated tree", async () => {
        const provider = new DclExplorerProvider_1.DclExplorerProvider();
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
        (0, vitest_1.expect)(roots?.map((item) => item.label)).toContain("Capabilities");
        const capabilities = roots?.find((item) => item.label === "Capabilities");
        const capability = capabilities?.children[0];
        (0, vitest_1.expect)(capability?.label).toBe("AcceptOrder");
        (0, vitest_1.expect)(capability?.children.map((item) => item.label)).toEqual([
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
//# sourceMappingURL=DclExplorerProvider.test.js.map