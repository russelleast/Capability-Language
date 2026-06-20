import * as fs from "fs";
import * as path from "path";

export type DclLspSource = "configured" | "bundled" | "path";

export interface DclLspCommand {
  command: string;
  args: string[];
  cwd?: string;
  source: DclLspSource;
  bundledPath?: string;
  bundledAvailable: boolean;
}

export interface DclLspResolverOptions {
  configuredPath?: string;
  extensionPath?: string;
  workspaceFolders?: readonly string[];
  platform?: NodeJS.Platform;
  existsSync?: (file: string) => boolean;
}

export function resolveDclLsp(options: DclLspResolverOptions): DclLspCommand {
  const platform = options.platform ?? process.platform;
  const existsSync = options.existsSync ?? fs.existsSync;
  const configured = (options.configuredPath ?? "").trim();
  const bundledName = platform === "win32" ? "dcl-lsp.exe" : "dcl-lsp";
  const bundledPath = options.extensionPath ? path.join(options.extensionPath, "bin", bundledName) : undefined;
  const bundledAvailable = Boolean(bundledPath && existsSync(bundledPath));
  const cwd = options.workspaceFolders?.[0];

  if (configured) {
    const [command, ...args] = splitCommand(configured);
    return { command: command || configured, args, cwd, source: "configured", bundledPath, bundledAvailable };
  }

  if (bundledPath && bundledAvailable) {
    return { command: bundledPath, args: [], cwd, source: "bundled", bundledPath, bundledAvailable };
  }

  return { command: "dcl-lsp", args: [], cwd, source: "path", bundledPath, bundledAvailable };
}

export function splitCommand(commandLine: string): string[] {
  const parts = commandLine.match(/"[^"]+"|'[^']+'|\S+/g) ?? [];
  return parts.map((part) => part.replace(/^["']|["']$/g, ""));
}

