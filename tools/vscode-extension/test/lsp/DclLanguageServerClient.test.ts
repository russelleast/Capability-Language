import * as vscode from "vscode";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DclLanguageServerClient } from "../../src/lsp/DclLanguageServerClient";

describe("DclLanguageServerClient", () => {
  afterEach(() => {
    vscode.window.outputChannels.length = 0;
    vscode.workspace.workspaceFolders = [];
    vscode.workspace.textDocuments = [];
    vscode.workspace.configuration = {};
  });

  it("reports failed instead of running after async ENOENT spawn failure", () => {
    const fakeProcess = new FakeLanguageServerProcess();
    const spawn = vi.fn(() => fakeProcess as never);
    const client = new DclLanguageServerClient(vscode.Uri.file("/ext"), spawn as never);

    client.start();
    fakeProcess.emit("error", Object.assign(new Error("spawn dcl-lsp ENOENT"), { code: "ENOENT" }));

    expect(client.status()).toMatchObject({
      state: "failed",
      running: false,
      command: "dcl-lsp",
      source: "path",
      lastError: "spawn dcl-lsp ENOENT",
    });
    expect(vscode.window.outputChannels[0].lines.join("\n")).toContain("Build dcl-lsp or set dcl.languageServer.path.");
    client.dispose();
  });

  it("hides raw protocol responses by default and shows friendly initialization", () => {
    const fakeProcess = new FakeLanguageServerProcess();
    const client = new DclLanguageServerClient(vscode.Uri.file("/ext"), vi.fn(() => fakeProcess as never) as never);

    client.start();
    fakeProcess.stdout.emit(frame({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } }));

    const output = vscode.window.outputChannels[0].lines.join("\n");
    expect(output).toContain("DCL language server initialized.");
    expect(output).not.toContain("Content-Length");
    expect(output).not.toContain("LSP response:");
    client.dispose();
  });

  it("shows protocol payloads when message tracing is enabled", () => {
    vscode.workspace.configuration["dcl.languageServer.trace"] = "messages";
    const fakeProcess = new FakeLanguageServerProcess();
    const client = new DclLanguageServerClient(vscode.Uri.file("/ext"), vi.fn(() => fakeProcess as never) as never);

    client.start();
    fakeProcess.stdout.emit(frame({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } }));

    const output = vscode.window.outputChannels[0].lines.join("\n");
    expect(output).toContain("LSP send:");
    expect(output).toContain("LSP receive:");
    expect(output).toContain('"method":"initialize"');
    expect(output).not.toContain("Content-Length");
    client.dispose();
  });
});

class FakeLanguageServerProcess {
  readonly stdin = { write: vi.fn() };
  readonly stdout = new FakeProcessStream();
  readonly stderr = new FakeProcessStream();
  readonly kill = vi.fn();
  private readonly handlers = new Map<string, (value: unknown) => void>();

  on(event: string, handler: (value: unknown) => void): this {
    this.handlers.set(event, handler);
    return this;
  }

  emit(event: string, value: unknown): void {
    this.handlers.get(event)?.(value);
  }
}

class FakeProcessStream {
  private readonly handlers = new Map<string, (value: Buffer) => void>();

  on(event: string, handler: (value: Buffer) => void): this {
    this.handlers.set(event, handler);
    return this;
  }

  emit(value: string): void {
    this.handlers.get("data")?.(Buffer.from(value, "utf8"));
  }
}

function frame(message: unknown): string {
  const payload = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`;
}
