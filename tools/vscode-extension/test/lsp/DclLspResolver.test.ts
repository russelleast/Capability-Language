import { describe, expect, it } from "vitest";
import { resolveDclLsp } from "../../src/lsp/DclLspResolver";

describe("DclLspResolver", () => {
  it("uses explicit dcl.languageServer.path before bundled binaries", () => {
    const command = resolveDclLsp({
      configuredPath: "\"/opt/dcl lsp\" --stdio",
      extensionPath: "/ext",
      workspaceFolders: ["/workspace"],
      platform: "darwin",
      existsSync: () => true,
    });

    expect(command).toMatchObject({
      command: "/opt/dcl lsp",
      args: ["--stdio"],
      cwd: "/workspace",
      source: "configured",
    });
  });

  it("uses the local extension dcl-lsp binary when available", () => {
    const command = resolveDclLsp({
      extensionPath: "/ext",
      platform: "linux",
      existsSync: (file) => file === "/ext/bin/dcl-lsp",
    });

    expect(command).toMatchObject({
      command: "/ext/bin/dcl-lsp",
      args: [],
      source: "bundled",
      bundledAvailable: true,
    });
  });

  it("uses the Windows local extension dcl-lsp.exe binary when available", () => {
    const command = resolveDclLsp({
      extensionPath: "C:\\ext",
      platform: "win32",
      existsSync: (file) => file.endsWith("bin/dcl-lsp.exe") || file.endsWith("\\bin\\dcl-lsp.exe"),
    });

    expect(command.command).toMatch(/dcl-lsp\.exe$/);
    expect(command.source).toBe("bundled");
  });

  it("falls back to dcl-lsp from PATH when no local binary exists", () => {
    const command = resolveDclLsp({
      extensionPath: "/ext",
      platform: "darwin",
      existsSync: () => false,
    });

    expect(command).toMatchObject({
      command: "dcl-lsp",
      source: "path",
      bundledPath: "/ext/bin/dcl-lsp",
      bundledAvailable: false,
    });
  });
});
