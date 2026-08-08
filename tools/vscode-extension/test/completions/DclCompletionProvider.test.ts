import { describe, expect, it } from "vitest";
import { completionLabels } from "../../src/completions/DclCompletionProvider";

describe("DCL completions", () => {
  it("does not offer 1.1 constructs to DCL 1.0", () => {
    const labels = completionLabels("language dcl 1.0\nshape Value { value: }");
    expect(labels).not.toContain("Integer");
    expect(labels).not.toContain("measure");
    expect(labels).not.toContain("shape-enum");
  });

  it("offers 1.1 constructs to DCL 1.1", () => {
    const labels = completionLabels("language dcl 1.1\nshape Value { value: }");
    expect(labels).toContain("Integer");
    expect(labels).toContain("measure");
    expect(labels).toContain("shape-enum");
  });
});

