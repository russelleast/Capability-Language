import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as vscode from "vscode";
import { resolveDclLanguageServer } from "./DclLanguageServerResolver";

type JsonRpcId = number;

export type DclLanguageServerStatus = {
  running: boolean;
  command?: string;
  source?: string;
  workspaceCount: number;
  openDocumentCount: number;
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

  constructor(private readonly extensionUri: vscode.Uri) {
    this.output = vscode.window.createOutputChannel("DCL Language Server");
  }

  startIfEnabled(): void {
    if (!vscode.workspace.getConfiguration("dcl.languageServer").get<boolean>("enabled", false)) {
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
    this.output.appendLine(`Starting DCL language server: ${this.commandLine}`);

    try {
      this.process = spawn(command.command, command.args, {
        cwd: command.cwd,
        stdio: "pipe",
      });
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`Failed to start DCL language server: ${this.lastError}`);
      return;
    }

    this.process.stderr.on("data", (chunk: Buffer) => {
      this.output.append(chunk.toString());
    });
    this.process.stdout.on("data", (chunk: Buffer) => {
      this.output.appendLine(`LSP response: ${chunk.toString().trim()}`);
    });
    this.process.on("error", (error) => {
      this.lastError = error.message;
      this.output.appendLine(`DCL language server error: ${error.message}`);
    });
    this.process.on("exit", (code, signal) => {
      this.output.appendLine(`DCL language server stopped${code === null ? "" : ` with code ${code}`}${signal ? ` signal ${signal}` : ""}.`);
      this.process = undefined;
      this.openDocuments.clear();
    });

    this.sendRequest("initialize", {
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
      running: Boolean(this.process),
      command: this.commandLine,
      source: this.source,
      workspaceCount: vscode.workspace.workspaceFolders?.length ?? 0,
      openDocumentCount: this.openDocuments.size,
      lastError: this.lastError,
    };
  }

  showStatus(): void {
    const status = this.status();
    const lines = [
      `Status: ${status.running ? "running" : "stopped"}`,
      status.command ? `Command: ${status.command}` : undefined,
      status.source ? `Source: ${status.source}` : undefined,
      `Workspace count: ${status.workspaceCount}`,
      `Open document count: ${status.openDocumentCount}`,
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
    this.output.dispose();
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
    this.process.stdin.write(`Content-Length: ${payload.length}\r\n\r\n`);
    this.process.stdin.write(payload);
  }
}

function isDclFileDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "dcl" && document.uri.scheme === "file";
}
