import { describe, expect, it } from "vitest";
import { bundledLanguageServerName, resolveDclLanguageServer } from "../../src/lsp/DclLanguageServerResolver";

describe("DclLanguageServerResolver", () => {
  it("uses explicit dcl.languageServer.path before bundled servers", () => {
    const command = resolveDclLanguageServer({
      configuredLanguageServerPath: "/custom/dcl-lsp --trace",
      extensionPath: "/ext",
      workspaceFolders: ["/workspace"],
      platform: "linux",
      arch: "x64",
      existsSync: () => true,
    });

    expect(command).toMatchObject({
      command: "/custom/dcl-lsp",
      args: ["--trace"],
      cwd: "/workspace",
      source: "configured",
      bundledPath: "/ext/bin/dcl-lsp-linux-x64",
      bundledAvailable: true,
    });
  });

  it("uses a bundled language server when available", () => {
    const command = resolveDclLanguageServer({
      extensionPath: "/ext",
      platform: "darwin",
      arch: "arm64",
      existsSync: (file) => file === "/ext/bin/dcl-lsp-darwin-arm64",
    });

    expect(command).toMatchObject({
      command: "/ext/bin/dcl-lsp-darwin-arm64",
      args: [],
      source: "bundled",
      bundledAvailable: true,
    });
  });

  it("falls back to dcl-lsp on PATH", () => {
    const command = resolveDclLanguageServer({
      extensionPath: "/ext",
      platform: "linux",
      arch: "x64",
      existsSync: () => false,
    });

    expect(command).toMatchObject({
      command: "dcl-lsp",
      args: [],
      source: "path",
      bundledPath: "/ext/bin/dcl-lsp-linux-x64",
      bundledAvailable: false,
    });
  });

  it("names supported bundled language servers", () => {
    expect(bundledLanguageServerName("win32", "x64")).toBe("dcl-lsp-win32-x64.exe");
    expect(bundledLanguageServerName("darwin", "arm64")).toBe("dcl-lsp-darwin-arm64");
    expect(bundledLanguageServerName("freebsd" as NodeJS.Platform, "x64")).toBeUndefined();
  });
});
