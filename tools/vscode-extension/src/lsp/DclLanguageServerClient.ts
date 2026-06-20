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
  private diagnosticsCount = 0;
  private lastValidationTimestamp: string | undefined;

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

    this.initializeRequestId = this.sendRequest("initialize", {
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

  dispose(): void {
    for (const disposable of this.disposables.splice(0)) disposable.dispose();
    if (this.process) {
      this.sendRequest("shutdown", null);
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

  private sendRequest(method: string, params: unknown): JsonRpcId {
    const id = this.nextId++;
    this.write({ jsonrpc: "2.0", id, method, params });
    return id;
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
    if (message.method === "dcl/validationStatus") {
      this.diagnosticsCount = message.params?.diagnosticsCount ?? 0;
      this.lastValidationTimestamp = message.params?.lastValidationTimestamp;
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
}

function isDclFileDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "dcl" && document.uri.scheme === "file";
}

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
