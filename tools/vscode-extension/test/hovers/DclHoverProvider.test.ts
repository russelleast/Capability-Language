import { describe, expect, it } from "vitest";
import { HOVERS } from "../../src/hovers/DclHoverProvider";

describe("DclHoverProvider hover text", () => {
  it("documents v0.10 actor kinds without stale actor types", () => {
    expect(HOVERS.actor).toContain("human");
    expect(HOVERS.actor).toContain("system");
    expect(HOVERS.actor).toContain("agent");
    expect(HOVERS.actor).toContain("scheduled_process");
    expect(HOVERS.actor).not.toMatch(/external_system|internal_system|authority/);
  });

  it("documents v0.10 effect, policy, and when syntax", () => {
    expect(HOVERS.effect).toContain("tool");
    expect(HOVERS.policy).toContain("performance { ... }");
    expect(HOVERS.policy).toContain("confidence { threshold 0.8 }");
    expect(HOVERS.when).toContain("always Outcome");
  });
});
