import * as vscode from "vscode";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DclLanguageServerClient } from "../../src/lsp/DclLanguageServerClient";

describe("DclLanguageServerClient", () => {
  afterEach(() => {
    vscode.window.outputChannels.length = 0;
    vscode.workspace.workspaceFolders = [];
    vscode.workspace.textDocuments = [];
    vscode.workspace.configuration = {};
    vscode.window.activeTextEditor = undefined;
    vscode.window.informationMessages.length = 0;
    vscode.languages.documentSymbolProviders.length = 0;
    vscode.languages.workspaceSymbolProviders.length = 0;
    vscode.languages.definitionProviders.length = 0;
    vscode.languages.referenceProviders.length = 0;
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

  it("updates status from validation status notifications", () => {
    const fakeProcess = new FakeLanguageServerProcess();
    const client = new DclLanguageServerClient(vscode.Uri.file("/ext"), vi.fn(() => fakeProcess as never) as never);

    client.start();
    fakeProcess.stdout.emit(frame({
      jsonrpc: "2.0",
      method: "dcl/validationStatus",
      params: {
        diagnosticsCount: 3,
        lastValidationTimestamp: "2026-06-19T15:30:00Z",
      },
    }));

    expect(client.status()).toMatchObject({
      diagnosticsCount: 3,
      lastValidationTimestamp: "2026-06-19T15:30:00Z",
    });
    client.dispose();
  });

  it("registers document symbol provider and maps server results", async () => {
    const fakeProcess = new FakeLanguageServerProcess();
    const client = new DclLanguageServerClient(vscode.Uri.file("/ext"), vi.fn(() => fakeProcess as never) as never);

    client.start();
    const provider = vscode.languages.documentSymbolProviders[0] as {
      provideDocumentSymbols(document: vscode.TextDocument): Promise<vscode.DocumentSymbol[]>;
    };
    const promise = provider.provideDocumentSymbols(dclDocument("/workspace/payment.dcl", "language dcl 0.10\n"));
    fakeProcess.stdout.emit(frame({
      jsonrpc: "2.0",
      id: 2,
      result: [{
        name: "CapturePayment",
        detail: "Capability",
        kind: 5,
        range: range(2, 0),
        selectionRange: range(2, 0),
      }],
    }));

    await expect(promise).resolves.toMatchObject([{ name: "CapturePayment", detail: "Capability" }]);
    client.dispose();
  });

  it("registers workspace symbol provider and maps server results", async () => {
    const fakeProcess = new FakeLanguageServerProcess();
    const client = new DclLanguageServerClient(vscode.Uri.file("/ext"), vi.fn(() => fakeProcess as never) as never);

    client.start();
    const provider = vscode.languages.workspaceSymbolProviders[0] as {
      provideWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]>;
    };
    const promise = provider.provideWorkspaceSymbols("payment");
    fakeProcess.stdout.emit(frame({
      jsonrpc: "2.0",
      id: 2,
      result: [{
        name: "PaymentCaptured",
        detail: "Event",
        kind: 24,
        containerName: "Payments",
        location: { uri: "file:///workspace/events.dcl", range: range(4, 0) },
      }],
    }));

    const symbols = await promise;
    expect(symbols[0]).toMatchObject({ name: "PaymentCaptured", containerName: "Payments" });
    expect(symbols[0].location.uri.fsPath).toBe("/workspace/events.dcl");
    client.dispose();
  });

  it("registers definition and reference providers", async () => {
    const fakeProcess = new FakeLanguageServerProcess();
    const client = new DclLanguageServerClient(vscode.Uri.file("/ext"), vi.fn(() => fakeProcess as never) as never);
    const document = dclDocument("/workspace/payment.dcl", "language dcl 0.10\n");

    client.start();
    const definitionProvider = vscode.languages.definitionProviders[0] as {
      provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]>;
    };
    const definitionPromise = definitionProvider.provideDefinition(document, new vscode.Position(5, 10));
    fakeProcess.stdout.emit(frame({
      jsonrpc: "2.0",
      id: 2,
      result: { uri: "file:///workspace/events.dcl", range: range(2, 0) },
    }));
    await expect(definitionPromise).resolves.toHaveLength(1);

    const referenceProvider = vscode.languages.referenceProviders[0] as {
      provideReferences(document: vscode.TextDocument, position: vscode.Position, context: { includeDeclaration: boolean }): Promise<vscode.Location[]>;
    };
    const referencesPromise = referenceProvider.provideReferences(document, new vscode.Position(5, 10), { includeDeclaration: true });
    fakeProcess.stdout.emit(frame({
      jsonrpc: "2.0",
      id: 3,
      result: [
        { uri: "file:///workspace/events.dcl", range: range(2, 0) },
        { uri: "file:///workspace/payment.dcl", range: range(8, 10) },
      ],
    }));
    await expect(referencesPromise).resolves.toHaveLength(2);
    client.dispose();
  });

  it("shows symbol inspection details from the language server", async () => {
    const fakeProcess = new FakeLanguageServerProcess();
    const client = new DclLanguageServerClient(vscode.Uri.file("/ext"), vi.fn(() => fakeProcess as never) as never);
    const document = dclDocument("/workspace/payment.dcl", "language dcl 0.10\n");
    vscode.window.activeTextEditor = { document, selection: { active: new vscode.Position(5, 10) } };

    client.start();
    const promise = client.inspectSymbolAtCursor();
    fakeProcess.stdout.emit(frame({
      jsonrpc: "2.0",
      id: 2,
      result: {
        uri: "file:///workspace/payment.dcl",
        line: 5,
        column: 10,
        token: "PaymentCaptured",
        kind: "EventReference",
        symbolIdentity: { kind: "event", context: "default", name: "PaymentCaptured" },
        definition: { uri: "file:///workspace/events.dcl", range: range(2, 0) },
        referenceCount: 7,
      },
    }));
    await promise;

    expect(vscode.window.informationMessages.at(-1)).toContain("PaymentCaptured");
    expect(vscode.window.informationMessages.at(-1)).toContain("ReferenceCount:\n7");
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

function range(line: number, character: number) {
  return {
    start: { line, character },
    end: { line, character: character + 1 },
  };
}

function dclDocument(file: string, text: string): vscode.TextDocument {
  return {
    uri: vscode.Uri.file(file),
    languageId: "dcl",
    version: 1,
    getText: () => text,
  };
}
