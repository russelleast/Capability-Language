import { describe, expect, it } from "vitest";
import { causeEffectLayoutPositions, weaklyConnectedComponents } from "../../src/graphs/DclCauseEffectLayout";
import { DclGraphModel } from "../../src/graphs/DclGraphModel";

describe("DclCauseEffectLayout", () => {
  it("detects multiple weakly connected components", () => {
    const graph = graphModel(
      ["capability:a", "outcome:a", "event:b", "step:b"],
      [["capability:a", "outcome:a"], ["event:b", "step:b"]],
    );

    expect(weaklyConnectedComponents(graph)).toEqual([
      ["capability:a", "outcome:a"],
      ["event:b", "step:b"],
    ]);
  });

  it("orders components deterministically", () => {
    const graph = graphModel(
      ["event:z", "capability:a", "step:z", "outcome:a"],
      [["event:z", "step:z"], ["capability:a", "outcome:a"]],
    );

    expect(weaklyConnectedComponents(graph)[0]).toEqual(["capability:a", "outcome:a"]);
  });

  it("places disconnected components in separate layout regions", () => {
    const graph = graphModel(
      ["capability:a", "outcome:a", "event:b", "step:b"],
      [["capability:a", "outcome:a"], ["event:b", "step:b"]],
    );
    const positions = causeEffectLayoutPositions(graph);

    expect(Math.abs(positions["capability:a"].x - positions["event:b"].x)).toBeGreaterThan(200);
  });

  it("keeps a single connected graph in left-to-right causal order", () => {
    const graph = graphModel(
      ["capability:a", "outcome:a", "event:a", "lifecycle-transition:a", "step:a"],
      [
        ["capability:a", "outcome:a"],
        ["outcome:a", "event:a"],
        ["event:a", "lifecycle-transition:a"],
        ["lifecycle-transition:a", "step:a"],
      ],
    );
    const positions = causeEffectLayoutPositions(graph);

    expect(positions["capability:a"].x).toBeLessThan(positions["outcome:a"].x);
    expect(positions["outcome:a"].x).toBeLessThan(positions["event:a"].x);
    expect(positions["event:a"].x).toBeLessThan(positions["lifecycle-transition:a"].x);
    expect(positions["lifecycle-transition:a"].x).toBeLessThan(positions["step:a"].x);
  });
});

function graphModel(ids: string[], edges: Array<[string, string]>): DclGraphModel {
  return {
    title: "Test Cause and Effect Graph",
    nodes: ids.map((id) => {
      const [kind, name] = id.split(":");
      return { id, kind, label: name };
    }),
    edges: edges.map(([source, target], index) => ({
      id: `edge:${index}`,
      source,
      target,
      label: "causes",
      kind: "test",
    })),
  };
}
