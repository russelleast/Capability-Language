import { describe, expect, it } from "vitest";
import { buildCapabilityMap, capabilityMapItems } from "../../src/graphs/DclCapabilityMapBuilder";
import { SemanticSummary } from "../../src/views/semanticSummary";

describe("DclCapabilityMapBuilder", () => {
  it("builds context containers with nested child contexts and capability tiles", () => {
    const map = buildCapabilityMap(summary({
      contexts: [
        { name: "Commerce", children: ["Sales"] },
        { name: "Sales" },
      ],
      capabilities: [{ name: "AcceptOrder", context: "Sales" }],
    }));

    expect(map?.root.children[0].name).toBe("Commerce");
    expect(map?.root.children[0].children[0].name).toBe("Sales");
    expect(map?.root.children[0].children[0].capabilities[0]).toMatchObject({
      id: "capability:acceptorder",
      name: "AcceptOrder",
      kind: "capability",
      semanticIdentity: { kind: "capability", name: "AcceptOrder" },
    });
  });

  it("places multiple capabilities in one owning context", () => {
    const map = buildCapabilityMap(summary({
      contexts: [{ name: "Sales" }],
      capabilities: [
        { name: "AcceptOrder", context: "Sales" },
        { name: "QuoteOrder", context: "Sales" },
      ],
    }));

    expect(map?.root.children[0].capabilities.map((capability) => capability.name)).toEqual(["AcceptOrder", "QuoteOrder"]);
  });

  it("does not add metadata badges to capability tiles", () => {
    const map = buildCapabilityMap(summary({
      contexts: [{ name: "Claims" }],
      capabilities: [{
        name: "AssessClaim",
        context: "Claims",
        lifecycle: { begin: "Received" },
        effects: ["RecordAssessment"],
        events: ["ClaimAssessed"],
        policies: ["ClaimPolicy"],
      }],
      diagnostics: [{ severity: "warning", message: "Ambiguous lifecycle transition", node: "AssessClaim" }],
    }));

    expect(map?.root.children[0].capabilities[0].badges).toEqual([]);
    expect(map?.root.children[0].capabilities[0].diagnostics).toHaveLength(1);
  });

  it("uses an unlabelled synthetic root when declared contexts are unavailable", () => {
    const map = buildCapabilityMap(summary({
      capabilities: [{ name: "AcceptOrder" }],
    }));

    expect(map?.root.name).toBe("");
    expect(map?.root.synthetic).toBe(true);
    expect(map?.root.capabilities.map((capability) => capability.name)).toEqual(["AcceptOrder"]);
    expect(map?.warnings).toBeUndefined();
  });

  it("places capabilities with missing declared contexts in the unlabelled fallback area with a warning", () => {
    const map = buildCapabilityMap(summary({
      contexts: [{ name: "Sales" }],
      capabilities: [{ name: "AcceptOrder", context: "Missing" }],
    }));

    expect(map?.root.capabilities.map((capability) => capability.name)).toEqual(["AcceptOrder"]);
    expect(map?.warnings?.[0]).toMatch(/references context 'Missing'/);
    expect(map?.warnings?.[0]).not.toMatch(/Program/);
  });

  it("does not create a visible Program context for multiple top-level contexts", () => {
    const map = buildCapabilityMap(summary({
      contexts: [{ name: "Sales" }, { name: "Support" }],
      capabilities: [{ name: "AcceptOrder", context: "Sales" }, { name: "AnswerCase", context: "Support" }],
    }));

    expect(map?.root.synthetic).toBe(true);
    expect(map?.root.children.map((context) => context.name)).toEqual(["Sales", "Support"]);
    expect(capabilityMapItems(map).some((item) => item.name === "Program")).toBe(false);
  });

  it("returns no model when no capabilities exist", () => {
    expect(buildCapabilityMap(summary({ contexts: [{ name: "Sales" }] }))).toBeUndefined();
  });

  it("preserves source navigation metadata", () => {
    const source = { file: "sales.dcl", line: 3, column: 1 };
    const map = buildCapabilityMap(summary({
      contexts: [{ name: "Sales", location: { file: "context.dcl", line: 1, column: 1 } }],
      capabilities: [{ name: "AcceptOrder", context: "Sales", location: source }],
    }));

    expect(capabilityMapItems(map).find((item) => item.id === "capability:acceptorder")?.source).toEqual(source);
    expect(capabilityMapItems(map).find((item) => item.id === "context:sales")?.source).toEqual({ file: "context.dcl", line: 1, column: 1 });
  });
});

function summary(value: Partial<SemanticSummary>): SemanticSummary {
  return {
    capabilities: [],
    ...value,
  };
}
