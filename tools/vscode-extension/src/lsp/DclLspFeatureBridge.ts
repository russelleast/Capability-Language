import * as childProcess from "child_process";
import * as fs from "fs";
import * as vscode from "vscode";
import { DclLspCommand, resolveDclLsp } from "./DclLspResolver";

const DCL_SELECTOR: vscode.DocumentSelector = { language: "dcl", scheme: "file" };

interface LspPosition {
  line: number;
  character: number;
}

interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

interface LspLocation {
  uri: string;
  range: LspRange;
}

interface LspDocumentSymbol {
  name: string;
  detail?: string;
  kind: number;
  range: LspRange;
  selectionRange: LspRange;
  children?: LspDocumentSymbol[];
}

interface LspWorkspaceSymbol {
  name: string;
  kind: number;
  location?: LspLocation;
  containerName?: string;
}

interface FeatureTelemetry {
  supported: boolean;
  lastRequest?: string;
  lastResultCount?: number;
  lastReason?: string;
}

export class DclLspFeatureBridge implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly output: vscode.OutputChannel;
  private status: Record<string, FeatureTelemetry> = {
    diagnostics: { supported: true },
    documentSymbols: { supported: true },
    workspaceSymbols: { supported: true },
    definitions: { supported: true },
    references: { supported: true },
  };

  constructor(private readonly extensionPath: string) {
    this.output = vscode.window.createOutputChannel("DCL Language Server");
    this.disposables.push(this.output);
  }

  register(): void {
    this.disposables.push(
      vscode.languages.registerDocumentSymbolProvider(DCL_SELECTOR, {
        provideDocumentSymbols: async (document) => {
          const symbols = await this.request<LspDocumentSymbol[]>(
            "textDocument/documentSymbol",
            { textDocument: { uri: document.uri.toString() } },
            document,
          );
          this.record("documentSymbols", document.uri.toString(), symbols?.length ?? 0);
          return (symbols ?? []).map(toDocumentSymbol);
        },
      }),
      vscode.languages.registerWorkspaceSymbolProvider({
        provideWorkspaceSymbols: async (query) => {
          const symbols = await this.request<LspWorkspaceSymbol[]>("workspace/symbol", { query });
          this.record("workspaceSymbols", query || "(empty query)", symbols?.length ?? 0);
          return (symbols ?? []).flatMap(toSymbolInformation);
        },
      }),
      vscode.languages.registerDefinitionProvider(DCL_SELECTOR, {
        provideDefinition: async (document, position) => {
          const location = await this.request<LspLocation | LspLocation[] | null>(
            "textDocument/definition",
            {
              textDocument: { uri: document.uri.toString() },
              position: toLspPosition(position),
            },
            document,
          );
          const locations = Array.isArray(location) ? location : location ? [location] : [];
          this.record("definitions", `${document.uri.toString()}:${position.line}:${position.character}`, locations.length);
          return locations.map(toLocation);
        },
      }),
      vscode.languages.registerReferenceProvider(DCL_SELECTOR, {
        provideReferences: async (document, position, context) => {
          const locations = await this.request<LspLocation[]>(
            "textDocument/references",
            {
              textDocument: { uri: document.uri.toString() },
              position: toLspPosition(position),
              context: { includeDeclaration: context.includeDeclaration },
            },
            document,
          );
          this.record("references", `${document.uri.toString()}:${position.line}:${position.character}`, locations?.length ?? 0);
          return (locations ?? []).map(toLocation);
        },
      }),
    );
  }

  featureStatus(): string {
    const lines = [
      "DCL Language Server feature status:",
      `Diagnostics enabled: ${yesNo(this.status.diagnostics.supported)} (extension diagnostics remain the fallback in this build)`,
      `Document symbols supported: ${yesNo(this.status.documentSymbols.supported)}`,
      `Workspace symbols supported: ${yesNo(this.status.workspaceSymbols.supported)}`,
      `Definitions supported: ${yesNo(this.status.definitions.supported)}`,
      `References supported: ${yesNo(this.status.references.supported)}`,
      "",
      featureLine("Document symbols", this.status.documentSymbols),
      featureLine("Workspace symbols", this.status.workspaceSymbols),
      featureLine("Definitions", this.status.definitions),
      featureLine("References", this.status.references),
    ];
    return lines.join("\n");
  }

  dispose(): void {
    for (const disposable of this.disposables.splice(0)) disposable.dispose();
  }

  private record(feature: keyof DclLspFeatureBridge["status"], request: string, count: number, reason = ""): void {
    this.status[feature] = {
      ...this.status[feature],
      lastRequest: request,
      lastResultCount: count,
      lastReason: count === 0 ? reason || "no results returned" : "",
    };
  }

  private async request<T>(method: string, params: unknown, document?: vscode.TextDocument): Promise<T | undefined> {
    const config = vscode.workspace.getConfiguration("dcl.languageServer");
    const trace = config.get<string>("trace", "off");
    const spec = resolveDclLsp({
      configuredPath: config.get<string>("path", ""),
      extensionPath: this.extensionPath,
      workspaceFolders: vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath),
    });
    ensureExecutable(spec);
    this.output.appendLine(`DCL LSP request: ${method}`);
    this.output.appendLine(`Starting DCL language server: ${spec.command}${spec.args.length ? ` ${spec.args.join(" ")}` : ""}`);
    this.output.appendLine(`Server source: ${spec.source}`);
    if (trace !== "off") this.output.appendLine(`LSP params: ${JSON.stringify(params)}`);

    try {
      const result = await sendRequest<T>(spec, method, params, document, trace, this.output);
      this.output.appendLine(`DCL LSP ${method} completed.`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`DCL language server error: ${message}`);
      if (/ENOENT/i.test(message)) {
        this.output.appendLine("Build dcl-lsp or set dcl.languageServer.path.");
      }
      void vscode.window.showWarningMessage(`DCL language server request failed: ${message}`);
      return undefined;
    }
  }
}

function sendRequest<T>(
  spec: DclLspCommand,
  method: string,
  params: unknown,
  document: vscode.TextDocument | undefined,
  trace: string,
  output: vscode.OutputChannel,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(spec.command, spec.args, { cwd: spec.cwd, stdio: "pipe" });
    const parser = new LspMessageParser();
    let settled = false;
    let nextID = 1;
    const initializeID = nextID++;
    const requestID = nextID++;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error(`${method} timed out`));
      }
    }, 10000);

    child.on("error", (error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(error);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString("utf8").split(/\r?\n/).filter(Boolean)) {
        output.appendLine(formatServerLog(line));
      }
    });
    child.stdout.on("data", (chunk: Buffer) => {
      for (const payload of parser.push(chunk)) {
        if (trace !== "off") output.appendLine(`LSP response: ${payload}`);
        const message = JSON.parse(payload) as { id?: number; result?: T; error?: { message?: string } };
        if (message.id !== requestID) continue;
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        child.stdin.write(frame({ jsonrpc: "2.0", id: nextID++, method: "shutdown" }));
        child.stdin.write(frame({ jsonrpc: "2.0", method: "exit" }));
        child.stdin.end();
        if (message.error) {
          reject(new Error(message.error.message ?? `${method} failed`));
        } else {
          resolve(message.result);
        }
      }
    });
    child.on("exit", (code) => {
      if (!settled && code !== 0) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`dcl-lsp exited with code ${code ?? "unknown"}`));
      }
    });

    child.stdin.write(frame({ jsonrpc: "2.0", id: initializeID, method: "initialize", params: initializeParams() }));
    child.stdin.write(frame({ jsonrpc: "2.0", method: "initialized", params: {} }));
    if (document) {
      child.stdin.write(frame({
        jsonrpc: "2.0",
        method: "textDocument/didOpen",
        params: {
          textDocument: {
            uri: document.uri.toString(),
            languageId: "dcl",
            version: document.version,
            text: document.getText(),
          },
        },
      }));
    }
    child.stdin.write(frame({ jsonrpc: "2.0", id: requestID, method, params }));
  });
}

function initializeParams(): unknown {
  const workspaceFolders = vscode.workspace.workspaceFolders?.map((folder) => ({
    uri: folder.uri.toString(),
    name: folder.name,
  })) ?? [];
  return {
    processId: process.pid,
    rootUri: workspaceFolders[0]?.uri ?? null,
    workspaceFolders,
    capabilities: {},
  };
}

function ensureExecutable(spec: DclLspCommand): void {
  if (spec.source !== "bundled" || process.platform === "win32") return;
  try {
    fs.chmodSync(spec.command, 0o755);
  } catch {
    // Let spawn surface the actionable failure with the attempted path.
  }
}

function frame(message: unknown): string {
  const payload = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`;
}

function toDocumentSymbol(symbol: LspDocumentSymbol): vscode.DocumentSymbol {
  const item = new vscode.DocumentSymbol(
    symbol.name,
    symbol.detail ?? "",
    symbol.kind as vscode.SymbolKind,
    toRange(symbol.range),
    toRange(symbol.selectionRange),
  );
  item.children = (symbol.children ?? []).map(toDocumentSymbol);
  return item;
}

function toSymbolInformation(symbol: LspWorkspaceSymbol): vscode.SymbolInformation[] {
  if (!symbol.location) return [];
  return [new vscode.SymbolInformation(
    symbol.name,
    symbol.kind as vscode.SymbolKind,
    symbol.containerName ?? "",
    toLocation(symbol.location),
  )];
}

function toLocation(location: LspLocation): vscode.Location {
  return new vscode.Location(vscode.Uri.parse(location.uri), toRange(location.range));
}

function toRange(range: LspRange): vscode.Range {
  return new vscode.Range(range.start.line, range.start.character, range.end.line, range.end.character);
}

function toLspPosition(position: vscode.Position): LspPosition {
  return { line: position.line, character: position.character };
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function featureLine(label: string, telemetry: FeatureTelemetry): string {
  return `${label}: last request ${telemetry.lastRequest ?? "(none)"}, last result count ${telemetry.lastResultCount ?? "(none)"}${telemetry.lastReason ? `, reason: ${telemetry.lastReason}` : ""}`;
}

function formatServerLog(line: string): string {
  try {
    const event = JSON.parse(line) as Record<string, unknown>;
    const name = typeof event.event === "string" ? event.event : "server log";
    const resultCount = typeof event.resultCount === "number" ? `, result count ${event.resultCount}` : "";
    const reason = typeof event.reason === "string" && event.reason ? `, reason: ${event.reason}` : "";
    const zeroReason = typeof event.zeroReason === "string" && event.zeroReason ? `, reason: ${event.zeroReason}` : "";
    const uri = typeof event.uri === "string" ? `, ${event.uri}` : "";
    const query = typeof event.query === "string" ? `, query "${event.query}"` : "";
    return `Server: ${name}${uri}${query}${resultCount}${reason || zeroReason}`;
  } catch {
    return `Server: ${line}`;
  }
}

class LspMessageParser {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): string[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: string[] = [];
    for (;;) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return messages;
      const header = this.buffer.subarray(0, headerEnd).toString("utf8");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        this.buffer = Buffer.alloc(0);
        return messages;
      }
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + length) return messages;
      messages.push(this.buffer.subarray(bodyStart, bodyStart + length).toString("utf8"));
      this.buffer = this.buffer.subarray(bodyStart + length);
    }
  }
}
