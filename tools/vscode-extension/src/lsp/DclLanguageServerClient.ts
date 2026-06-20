import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as vscode from "vscode";
import { resolveDclLanguageServer } from "./DclLanguageServerResolver";

type JsonRpcId = number;
type LanguageServerState = "disabled" | "stopped" | "running" | "failed";
type LanguageServerTrace = "off" | "messages" | "verbose";
type SpawnLanguageServer = typeof spawn;

export type DclLanguageServerStatus = {
  state: LanguageServerState;
  running: boolean;
  command?: string;
  source?: string;
  workspaceCount: number;
  openDocumentCount: number;
  diagnosticsCount: number;
  lastValidationTimestamp?: string;
  lastError?: string;
};

type FeatureName = "diagnostics" | "documentSymbols" | "workspaceSymbols" | "definitions" | "references";

type FeatureTelemetry = {
  supported: boolean;
  lastRequest?: string;
  lastResultCount?: number;
  lastReason?: string;
};

type PendingRequest = {
  method: string;
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
};

type LspPosition = { line: number; character: number };
type LspRange = { start: LspPosition; end: LspPosition };
type LspLocation = { uri: string; range: LspRange };
type LspDocumentSymbol = {
  name: string;
  detail?: string;
  kind: number;
  range: LspRange;
  selectionRange: LspRange;
  children?: LspDocumentSymbol[];
};
type LspWorkspaceSymbol = {
  name: string;
  detail?: string;
  kind: number;
  location?: LspLocation;
  containerName?: string;
};
type LspSymbolInspection = {
  uri: string;
  line: number;
  column: number;
  token?: string;
  kind?: string;
  symbolIdentity?: Record<string, string>;
  definition?: LspLocation;
  referenceCount: number;
  reason?: string;
};

export class DclLanguageServerClient implements vscode.Disposable {
  private process: ChildProcessWithoutNullStreams | undefined;
  private readonly output: vscode.OutputChannel;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly openDocuments = new Map<string, number>();
  private nextId = 1;
  private lastError: string | undefined;
  private commandLine: string | undefined;
  private source: string | undefined;
  private state: LanguageServerState = "stopped";
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private initializeRequestId: JsonRpcId | undefined;
  private readonly pendingRequests = new Map<JsonRpcId, PendingRequest>();
  private featureProvidersRegistered = false;
  private diagnosticsCount = 0;
  private lastValidationTimestamp: string | undefined;
  private readonly featureTelemetry: Record<FeatureName, FeatureTelemetry> = {
    diagnostics: { supported: true },
    documentSymbols: { supported: true },
    workspaceSymbols: { supported: true },
    definitions: { supported: true },
    references: { supported: true },
  };

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly spawnLanguageServer: SpawnLanguageServer = spawn,
  ) {
    this.output = vscode.window.createOutputChannel("DCL Language Server");
  }

  startIfEnabled(): void {
    if (!vscode.workspace.getConfiguration("dcl.languageServer").get<boolean>("enabled", false)) {
      this.state = "disabled";
      this.output.appendLine("DCL language server is disabled.");
      return;
    }
    this.start();
  }

  start(): void {
    if (this.process) return;

    const workspaceFolders = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
    const command = resolveDclLanguageServer({
      configuredLanguageServerPath: vscode.workspace.getConfiguration("dcl.languageServer").get<string>("path", ""),
      extensionPath: this.extensionUri.fsPath,
      workspaceFolders,
    });

    this.commandLine = [command.command, ...command.args].join(" ");
    this.source = command.source;
    this.state = "running";
    this.lastError = undefined;
    this.output.appendLine(`Starting DCL language server: ${this.commandLine}`);
    this.output.appendLine(`DCL language server source: ${command.source}`);

    try {
      this.process = this.spawnLanguageServer(command.command, command.args, {
        cwd: command.cwd,
        stdio: "pipe",
      });
    } catch (error) {
      this.recordStartFailure(error);
      return;
    }

    this.process.stderr.on("data", (chunk: Buffer) => this.handleStderr(chunk));
    this.process.stdout.on("data", (chunk: Buffer) => this.handleStdout(chunk));
    this.process.on("error", (error) => {
      this.recordStartFailure(error);
    });
    this.process.on("exit", (code, signal) => {
      this.output.appendLine(`DCL language server stopped${code === null ? "" : ` with code ${code}`}${signal ? ` signal ${signal}` : ""}.`);
      this.process = undefined;
      this.openDocuments.clear();
      if (this.state !== "failed") this.state = code && code !== 0 ? "failed" : "stopped";
    });

    this.initializeRequestId = this.sendRequestMessage("initialize", {
      processId: process.pid,
      rootUri: vscode.workspace.workspaceFolders?.[0]?.uri.toString(),
      workspaceFolders: vscode.workspace.workspaceFolders?.map((folder) => ({
        uri: folder.uri.toString(),
        name: folder.name,
      })) ?? [],
      capabilities: {},
    });
    this.sendNotification("initialized", {});
    this.registerDocumentForwarding();
    this.registerFeatureProviders();
    for (const document of vscode.workspace.textDocuments ?? []) {
      if (isDclFileDocument(document)) this.didOpen(document);
    }
  }

  status(): DclLanguageServerStatus {
    return {
      state: this.state,
      running: this.state === "running" && Boolean(this.process),
      command: this.commandLine,
      source: this.source,
      workspaceCount: vscode.workspace.workspaceFolders?.length ?? 0,
      openDocumentCount: this.openDocuments.size,
      diagnosticsCount: this.diagnosticsCount,
      lastValidationTimestamp: this.lastValidationTimestamp,
      lastError: this.lastError,
    };
  }

  showStatus(): void {
    const status = this.status();
    const lines = [
      `Status: ${status.state}`,
      status.command ? `Command: ${status.command}` : undefined,
      status.source ? `Source: ${status.source}` : undefined,
      `Workspace count: ${status.workspaceCount}`,
      `Open document count: ${status.openDocumentCount}`,
      `Diagnostics count: ${status.diagnosticsCount}`,
      status.lastValidationTimestamp ? `Last validation: ${status.lastValidationTimestamp}` : undefined,
      status.lastError ? `Last error: ${status.lastError}` : undefined,
    ].filter(Boolean).join("\n");
    void vscode.window.showInformationMessage(lines, { modal: true });
  }

  showFeatureStatus(): void {
    const lines = [
      "DCL Language Server feature status",
      "",
      `Diagnostics enabled: ${yesNo(this.featureTelemetry.diagnostics.supported)}`,
      `Document symbols supported: ${yesNo(this.featureTelemetry.documentSymbols.supported)}`,
      `Workspace symbols supported: ${yesNo(this.featureTelemetry.workspaceSymbols.supported)}`,
      `Definitions supported: ${yesNo(this.featureTelemetry.definitions.supported)}`,
      `References supported: ${yesNo(this.featureTelemetry.references.supported)}`,
      "",
      featureLine("Diagnostics", this.featureTelemetry.diagnostics),
      featureLine("Document symbols", this.featureTelemetry.documentSymbols),
      featureLine("Workspace symbols", this.featureTelemetry.workspaceSymbols),
      featureLine("Definitions", this.featureTelemetry.definitions),
      featureLine("References", this.featureTelemetry.references),
    ].join("\n");
    void vscode.window.showInformationMessage(lines, { modal: true });
  }

  async inspectSymbolAtCursor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isDclFileDocument(editor.document)) {
      void vscode.window.showWarningMessage("Open a .dcl file before inspecting a DCL symbol.");
      return;
    }
    const position = editor.selection.active;
    const inspection = await this.request<LspSymbolInspection>("dcl/inspectSymbol", {
      textDocument: { uri: editor.document.uri.toString() },
      position: toLspPosition(position),
    });
    if (!inspection) return;
    const lines = [
      "URI:",
      inspection.uri,
      "",
      "Line:",
      String(inspection.line + 1),
      "",
      "Column:",
      String(inspection.column + 1),
      "",
      "Token:",
      inspection.token || "(none)",
      "",
      "Kind:",
      inspection.kind || "(unresolved)",
      "",
      "Symbol identity:",
      inspection.symbolIdentity ? JSON.stringify(inspection.symbolIdentity) : "(none)",
      "",
      "Definition:",
      inspection.definition ? formatLocation(inspection.definition) : "(none)",
      "",
      "ReferenceCount:",
      String(inspection.referenceCount ?? 0),
      inspection.reason ? "" : undefined,
      inspection.reason ? "Reason:" : undefined,
      inspection.reason,
    ].filter((line): line is string => line !== undefined).join("\n");
    void vscode.window.showInformationMessage(lines, { modal: true });
  }

  dispose(): void {
    for (const disposable of this.disposables.splice(0)) disposable.dispose();
    if (this.process) {
      this.sendRequestMessage("shutdown", null);
      this.sendNotification("exit", {});
      this.process.kill();
      this.process = undefined;
    }
    if (this.state !== "failed") this.state = "stopped";
    this.output.dispose();
  }

  private recordStartFailure(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.lastError = message;
    this.state = "failed";
    this.process = undefined;
    this.openDocuments.clear();
    this.output.appendLine(`Failed to start DCL language server: ${message}`);
    if (this.commandLine) this.output.appendLine(`Attempted command: ${this.commandLine}`);
    if (/ENOENT/i.test(message)) {
      this.output.appendLine("Build dcl-lsp or set dcl.languageServer.path.");
    }
  }

  private registerDocumentForwarding(): void {
    if (this.disposables.length) return;
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((document) => {
        if (isDclFileDocument(document)) this.didOpen(document);
      }),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (isDclFileDocument(event.document)) this.didChange(event.document);
      }),
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (isDclFileDocument(document)) this.didSave(document);
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        if (isDclFileDocument(document)) this.didClose(document);
      }),
    );
  }

  private registerFeatureProviders(): void {
    if (this.featureProvidersRegistered) return;
    this.featureProvidersRegistered = true;
    this.disposables.push(
      vscode.languages.registerDocumentSymbolProvider(DCL_SELECTOR, {
        provideDocumentSymbols: async (document) => {
          const symbols = await this.request<LspDocumentSymbol[]>("textDocument/documentSymbol", {
            textDocument: { uri: document.uri.toString() },
          });
          return (symbols ?? []).map(toDocumentSymbol);
        },
      }),
      vscode.languages.registerWorkspaceSymbolProvider({
        provideWorkspaceSymbols: async (query) => {
          const symbols = await this.request<LspWorkspaceSymbol[]>("workspace/symbol", { query });
          return (symbols ?? []).flatMap(toSymbolInformation);
        },
      }),
      vscode.languages.registerDefinitionProvider(DCL_SELECTOR, {
        provideDefinition: async (document, position) => {
          const result = await this.request<LspLocation | LspLocation[] | null>("textDocument/definition", {
            textDocument: { uri: document.uri.toString() },
            position: toLspPosition(position),
          });
          const locations = Array.isArray(result) ? result : result ? [result] : [];
          return locations.map(toLocation);
        },
      }),
      vscode.languages.registerReferenceProvider(DCL_SELECTOR, {
        provideReferences: async (document, position, context) => {
          const locations = await this.request<LspLocation[]>("textDocument/references", {
            textDocument: { uri: document.uri.toString() },
            position: toLspPosition(position),
            context: { includeDeclaration: context.includeDeclaration },
          });
          return (locations ?? []).map(toLocation);
        },
      }),
    );
  }

  private didOpen(document: vscode.TextDocument): void {
    this.openDocuments.set(document.uri.toString(), document.version);
    this.sendNotification("textDocument/didOpen", {
      textDocument: {
        uri: document.uri.toString(),
        languageId: document.languageId,
        version: document.version,
        text: document.getText(),
      },
    });
  }

  private didChange(document: vscode.TextDocument): void {
    this.openDocuments.set(document.uri.toString(), document.version);
    this.sendNotification("textDocument/didChange", {
      textDocument: {
        uri: document.uri.toString(),
        version: document.version,
      },
      contentChanges: [{ text: document.getText() }],
    });
  }

  private didSave(document: vscode.TextDocument): void {
    this.sendNotification("textDocument/didSave", {
      textDocument: { uri: document.uri.toString() },
      text: document.getText(),
    });
  }

  private didClose(document: vscode.TextDocument): void {
    this.openDocuments.delete(document.uri.toString());
    this.sendNotification("textDocument/didClose", {
      textDocument: { uri: document.uri.toString() },
    });
  }

  private sendRequestMessage(method: string, params: unknown): JsonRpcId {
    const id = this.nextId++;
    this.write({ jsonrpc: "2.0", id, method, params });
    return id;
  }

  private request<T>(method: string, params: unknown): Promise<T | undefined> {
    if (!this.process || this.state !== "running") {
      this.output.appendLine(`DCL language server request skipped because the server is ${this.state}.`);
      return Promise.resolve(undefined);
    }
    const id = this.nextId++;
    return new Promise<T | undefined>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        const error = new Error(`${method} timed out`);
        this.output.appendLine(`DCL language server request failed: ${error.message}`);
        reject(error);
      }, 10000);
      this.pendingRequests.set(id, {
        method,
        timeout,
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.write({ jsonrpc: "2.0", id, method, params });
    }).catch((error) => {
      void vscode.window.showWarningMessage(`DCL language server request failed: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    });
  }

  private sendNotification(method: string, params: unknown): void {
    this.write({ jsonrpc: "2.0", method, params });
  }

  private write(message: unknown): void {
    if (!this.process) return;
    const payload = Buffer.from(JSON.stringify(message), "utf8");
    this.traceMessage("send", payload.toString("utf8"), `Content-Length: ${payload.length}\r\n\r\n${payload.toString("utf8")}`);
    this.process.stdin.write(`Content-Length: ${payload.length}\r\n\r\n`);
    this.process.stdin.write(payload);
  }

  private handleStdout(chunk: Buffer): void {
    const text = chunk.toString("utf8");
    this.stdoutBuffer += text;

    while (true) {
      const parsed = readBufferedLspMessage(this.stdoutBuffer);
      if (!parsed) return;
      this.stdoutBuffer = parsed.remaining;
      this.traceMessage("receive", parsed.payload, `Content-Length: ${Buffer.byteLength(parsed.payload, "utf8")}\r\n\r\n${parsed.payload}`);
      this.handleProtocolMessage(parsed.payload);
    }
  }

  private handleStderr(chunk: Buffer): void {
    this.stderrBuffer += chunk.toString("utf8");
    const lines = this.stderrBuffer.split(/\r?\n/);
    this.stderrBuffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      this.recordServerLogTelemetry(trimmed);
      this.output.appendLine(formatServerLog(trimmed));
    }
  }

  private handleProtocolMessage(payload: string): void {
    let message: {
      id?: number | string;
      method?: string;
      params?: { diagnosticsCount?: number; lastValidationTimestamp?: string };
      result?: unknown;
      error?: unknown;
    };
    try {
      message = JSON.parse(payload);
    } catch {
      return;
    }
    if (message.id === this.initializeRequestId && message.result && !message.error) {
      this.output.appendLine("DCL language server initialized.");
    }
    if (message.id !== undefined && this.pendingRequests.has(Number(message.id))) {
      const pending = this.pendingRequests.get(Number(message.id));
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(Number(message.id));
        if (message.error) {
          pending.reject(new Error(JSON.stringify(message.error)));
        } else {
          pending.resolve(message.result);
        }
      }
    }
    if (message.method === "dcl/validationStatus") {
      this.diagnosticsCount = message.params?.diagnosticsCount ?? 0;
      this.lastValidationTimestamp = message.params?.lastValidationTimestamp;
      this.featureTelemetry.diagnostics = {
        ...this.featureTelemetry.diagnostics,
        lastRequest: "workspace validation",
        lastResultCount: this.diagnosticsCount,
        lastReason: "",
      };
    }
    if (message.error) {
      this.output.appendLine(`DCL language server protocol error: ${JSON.stringify(message.error)}`);
    }
  }

  private traceMessage(direction: "send" | "receive", message: string, raw: string): void {
    const trace = languageServerTrace();
    if (trace === "off") return;
    if (trace === "verbose") {
      this.output.appendLine(`LSP ${direction} raw: ${raw}`);
      return;
    }
    this.output.appendLine(`LSP ${direction}: ${message}`);
  }

  private recordServerLogTelemetry(line: string): void {
    let record: { event?: string; uri?: string; query?: string; line?: number; character?: number; resultCount?: number; symbolCount?: number; referencesCount?: number; reason?: string };
    try {
      record = JSON.parse(line);
    } catch {
      return;
    }

    const feature = featureFromServerEvent(record.event);
    if (!feature) return;
    const resultCount = record.resultCount ?? record.symbolCount ?? record.referencesCount;
    const request = requestLabel(record);
    this.featureTelemetry[feature] = {
      ...this.featureTelemetry[feature],
      lastRequest: request,
      lastResultCount: typeof resultCount === "number" ? resultCount : this.featureTelemetry[feature].lastResultCount,
      lastReason: record.reason || "",
    };
  }
}

function isDclFileDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "dcl" && document.uri.scheme === "file";
}

const DCL_SELECTOR: vscode.DocumentSelector = { language: "dcl", scheme: "file" };

function languageServerTrace(): LanguageServerTrace {
  const value = vscode.workspace.getConfiguration("dcl.languageServer").get<string>("trace", "off");
  return value === "messages" || value === "verbose" ? value : "off";
}

function readBufferedLspMessage(buffer: string): { payload: string; remaining: string } | undefined {
  const headerEnd = buffer.indexOf("\r\n\r\n");
  if (headerEnd < 0) return undefined;

  const headers = buffer.slice(0, headerEnd).split("\r\n");
  const contentLengthHeader = headers.find((header) => /^Content-Length:/i.test(header));
  if (!contentLengthHeader) {
    return { payload: "", remaining: buffer.slice(headerEnd + 4) };
  }

  const length = Number(contentLengthHeader.split(":")[1]?.trim());
  if (!Number.isFinite(length) || length < 0) {
    return { payload: "", remaining: buffer.slice(headerEnd + 4) };
  }

  const payloadStart = headerEnd + 4;
  const payloadEnd = payloadStart + length;
  if (buffer.length < payloadEnd) return undefined;
  return {
    payload: buffer.slice(payloadStart, payloadEnd),
    remaining: buffer.slice(payloadEnd),
  };
}

function formatServerLog(line: string): string {
  try {
    const record = JSON.parse(line) as { event?: string; ts?: string; [key: string]: unknown };
    if (!record.event) return line;
    const details = Object.entries(record)
      .filter(([key]) => key !== "event" && key !== "ts")
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(" ");
    return details ? `Server: ${record.event} (${details})` : `Server: ${record.event}`;
  } catch {
    return line;
  }
}

function featureFromServerEvent(event: string | undefined): FeatureName | undefined {
  switch (event) {
    case "document symbols requested":
      return "documentSymbols";
    case "workspace symbols requested":
      return "workspaceSymbols";
    case "definition requested":
      return "definitions";
    case "references requested":
    case "references found":
      return "references";
    default:
      return undefined;
  }
}

function requestLabel(record: { uri?: string; query?: string; line?: number; character?: number }): string {
  if (record.query !== undefined) return `query "${record.query}"`;
  const position = typeof record.line === "number" && typeof record.character === "number"
    ? `:${record.line}:${record.character}`
    : "";
  return `${record.uri ?? "(unknown uri)"}${position}`;
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function featureLine(label: string, telemetry: FeatureTelemetry): string {
  return `${label}: last request ${telemetry.lastRequest ?? "(none)"}, last result count ${telemetry.lastResultCount ?? "(none)"}${telemetry.lastReason ? `, reason: ${telemetry.lastReason}` : ""}`;
}

function toDocumentSymbol(symbol: LspDocumentSymbol): vscode.DocumentSymbol {
  const item = new vscode.DocumentSymbol(
    symbol.name,
    symbol.detail ?? "",
    toVsCodeSymbolKind(symbol.kind),
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
    toVsCodeSymbolKind(symbol.kind),
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

function toVsCodeSymbolKind(kind: number): vscode.SymbolKind {
  return Math.max(0, kind - 1) as vscode.SymbolKind;
}

function formatLocation(location: LspLocation): string {
  return `${location.uri}:${location.range.start.line + 1}:${location.range.start.character + 1}`;
}
