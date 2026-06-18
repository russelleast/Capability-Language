import * as fs from "fs";
import * as path from "path";

export type DclCompilerSource = "configured" | "bundled" | "path";

export type DclCompilerCommand = {
  command: string;
  args: string[];
  cwd?: string;
  source: DclCompilerSource;
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
  bundledPath?: string;
  bundledAvailable: boolean;
  supportedBundleName?: string;
};

export type DclCompilerInfo = {
  command: string;
  args: string[];
  cwd?: string;
  source: DclCompilerSource;
  platform: NodeJS.Platform;
  arch: NodeJS.Architecture;
  bundledPath?: string;
  bundledAvailable: boolean;
  supportedBundleName?: string;
};

export type DclCompilerResolverOptions = {
  configuredCompilerPath?: string;
  extensionPath?: string;
  workspaceFolders?: readonly string[];
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  existsSync?: (file: string) => boolean;
};

export function resolveDclCompiler(options: DclCompilerResolverOptions): DclCompilerCommand {
  const info = getDclCompilerInfo(options);
  return {
    command: info.command,
    args: info.args,
    cwd: info.cwd,
    source: info.source,
    platform: info.platform,
    arch: info.arch,
    bundledPath: info.bundledPath,
    bundledAvailable: info.bundledAvailable,
    supportedBundleName: info.supportedBundleName,
  };
}

export function getDclCompilerInfo(options: DclCompilerResolverOptions): DclCompilerInfo {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const existsSync = options.existsSync ?? fs.existsSync;
  const configured = (options.configuredCompilerPath ?? "").trim();
  const bundledName = bundledCompilerName(platform, arch);
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
    command: "dcl",
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

export function bundledCompilerName(platform: NodeJS.Platform, arch: NodeJS.Architecture): string | undefined {
  if (platform === "darwin" && arch === "arm64") return "dcl-darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "dcl-darwin-x64";
  if (platform === "linux" && arch === "x64") return "dcl-linux-x64";
  if (platform === "win32" && arch === "x64") return "dcl-win32-x64.exe";
  return undefined;
}

export function splitCommand(commandLine: string): string[] {
  const parts = commandLine.match(/"[^"]+"|'[^']+'|\S+/g) ?? [];
  return parts.map((part) => part.replace(/^["']|["']$/g, ""));
}
