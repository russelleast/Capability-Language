import * as fs from "fs";
import * as path from "path";
import { splitCommand } from "../compiler/DclCompilerResolver";

export type DclLanguageServerSource = "configured" | "bundled" | "path";

export type DclLanguageServerCommand = {
  command: string;
  args: string[];
  cwd?: string;
  source: DclLanguageServerSource;
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
  bundledPath?: string;
  bundledAvailable: boolean;
  supportedBundleName?: string;
};

export type DclLanguageServerResolverOptions = {
  configuredLanguageServerPath?: string;
  extensionPath?: string;
  workspaceFolders?: readonly string[];
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  existsSync?: (file: string) => boolean;
};

export function resolveDclLanguageServer(options: DclLanguageServerResolverOptions): DclLanguageServerCommand {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const existsSync = options.existsSync ?? fs.existsSync;
  const configured = (options.configuredLanguageServerPath ?? "").trim();
  const bundledName = bundledLanguageServerName(platform, arch);
  const bundledPath = bundledName && options.extensionPath ? path.join(options.extensionPath, "bin", bundledName) : undefined;
  const bundledAvailable = Boolean(bundledPath && existsSync(bundledPath));
  const workspaceRoot = options.workspaceFolders?.[0];

  if (configured) {
    const [command, ...args] = splitCommand(configured);
    return {
      command: command || configured,
      args,
      cwd: workspaceRoot,
      source: "configured",
      platform,
      arch,
      bundledPath,
      bundledAvailable,
      supportedBundleName: bundledName,
    };
  }

  if (bundledPath && bundledAvailable) {
    return {
      command: bundledPath,
      args: [],
      cwd: workspaceRoot,
      source: "bundled",
      platform,
      arch,
      bundledPath,
      bundledAvailable,
      supportedBundleName: bundledName,
    };
  }

  return {
    command: "dcl-lsp",
    args: [],
    cwd: workspaceRoot,
    source: "path",
    platform,
    arch,
    bundledPath,
    bundledAvailable,
    supportedBundleName: bundledName,
  };
}

export function bundledLanguageServerName(platform: NodeJS.Platform, arch: NodeJS.Architecture): string | undefined {
  if (platform === "darwin" && arch === "arm64") return "dcl-lsp-darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "dcl-lsp-darwin-x64";
  if (platform === "linux" && arch === "x64") return "dcl-lsp-linux-x64";
  if (platform === "win32" && arch === "x64") return "dcl-lsp-win32-x64.exe";
  return undefined;
}
