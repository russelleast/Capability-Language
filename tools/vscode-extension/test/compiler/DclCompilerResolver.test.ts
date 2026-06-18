import { describe, expect, it } from "vitest";
import { bundledCompilerName, getDclCompilerInfo, resolveDclCompiler } from "../../src/compiler/DclCompilerResolver";

describe("DclCompilerResolver", () => {
  it("uses explicit dcl.compilerPath before bundled compilers", () => {
    const command = resolveDclCompiler({
      configuredCompilerPath: "\"/opt/dcl custom\" --flag",
      extensionPath: "/ext",
      workspaceFolders: ["/workspace"],
      platform: "darwin",
      arch: "arm64",
      existsSync: () => true,
    });

    expect(command).toMatchObject({
      command: "/opt/dcl custom",
      args: ["--flag"],
      cwd: "/workspace",
      source: "configured",
    });
  });

  it("uses bundled compiler when no override is configured", () => {
    const command = resolveDclCompiler({
      extensionPath: "/ext",
      platform: "linux",
      arch: "x64",
      existsSync: (file) => file === "/ext/bin/dcl-linux-x64",
    });

    expect(command).toMatchObject({
      command: "/ext/bin/dcl-linux-x64",
      args: [],
      source: "bundled",
    });
  });

  it("falls back to dcl from PATH when the matching bundle is absent", () => {
    const info = getDclCompilerInfo({
      extensionPath: "/ext",
      platform: "darwin",
      arch: "x64",
      existsSync: () => false,
    });

    expect(info).toMatchObject({
      command: "dcl",
      source: "path",
      bundledPath: "/ext/bin/dcl-darwin-x64",
      bundledAvailable: false,
      supportedBundleName: "dcl-darwin-x64",
    });
  });

  it("reports unsupported platforms without inventing a bundle name", () => {
    const info = getDclCompilerInfo({
      extensionPath: "/ext",
      platform: "freebsd",
      arch: "x64",
    });

    expect(info.supportedBundleName).toBeUndefined();
    expect(info.bundledPath).toBeUndefined();
    expect(info.source).toBe("path");
  });

  it.each([
    ["darwin", "arm64", "dcl-darwin-arm64"],
    ["darwin", "x64", "dcl-darwin-x64"],
    ["linux", "x64", "dcl-linux-x64"],
    ["win32", "x64", "dcl-win32-x64.exe"],
  ] as const)("maps %s %s to %s", (platform, arch, expected) => {
    expect(bundledCompilerName(platform, arch)).toBe(expected);
  });
});
