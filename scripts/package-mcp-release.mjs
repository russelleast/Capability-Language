import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const compilerDir = resolve(repoRoot, "compiler");
const outputRoot = resolve(repoRoot, process.argv[2] ?? "build/mcp-release");
const assetsDir = resolve(outputRoot, "assets");
const workDir = resolve(outputRoot, "work");
const versionJson = JSON.stringify(JSON.parse(readFileSync(resolve(repoRoot, "version.json"), "utf8")));
const versionLdflags = `-X capabilitylanguage/internal/version.embeddedJSON=${versionJson}`;

const targets = [
  { goos: "darwin", goarch: "arm64", archiveType: "tar.gz", binaryName: "dcl-mcp" },
  { goos: "darwin", goarch: "amd64", archiveType: "tar.gz", binaryName: "dcl-mcp" },
  { goos: "linux", goarch: "amd64", archiveType: "tar.gz", binaryName: "dcl-mcp" },
  { goos: "windows", goarch: "amd64", archiveType: "zip", binaryName: "dcl-mcp.exe" },
];

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(assetsDir, { recursive: true });
mkdirSync(workDir, { recursive: true });

for (const target of targets) {
  packageTarget(target);
}

console.log(`DCL MCP release assets written to ${assetsDir}`);

function packageTarget(target) {
  const targetName = `dcl-mcp-${target.goos}-${target.goarch}`;
  const packageDir = resolve(workDir, targetName);
  const binaryPath = resolve(packageDir, target.binaryName);
  const archiveName = `${targetName}.${target.archiveType}`;
  const archivePath = resolve(assetsDir, archiveName);

  mkdirSync(packageDir, { recursive: true });
  buildBinary(target, binaryPath);
  writePackageFiles(target, packageDir);

  if (target.archiveType === "tar.gz") {
    run("tar", ["-czf", archivePath, "-C", workDir, targetName], repoRoot);
  } else {
    run("zip", ["-qr", archivePath, targetName], workDir);
  }

  console.log(`Packaged ${basename(archivePath)}`);
}

function buildBinary(target, outputPath) {
  run(
    "go",
    ["build", "-trimpath", "-ldflags", versionLdflags, "-o", outputPath, "./cmd/dcl-mcp"],
    compilerDir,
    {
      ...process.env,
      CGO_ENABLED: "0",
      GOOS: target.goos,
      GOARCH: target.goarch,
    },
  );
  if (target.goos !== "windows") {
    chmodSync(outputPath, 0o755);
  }
}

function writePackageFiles(target, packageDir) {
  writeFileSync(resolve(packageDir, "README.md"), readmeFor(target));
  writeFileSync(resolve(packageDir, "mcp.vscode.json"), vscodeConfigFor(target));
  writeFileSync(resolve(packageDir, "mcp.claude-desktop.json"), claudeConfigFor(target));

  if (target.goos === "windows") {
    writeFileSync(resolve(packageDir, "install.ps1"), windowsInstallScript());
  } else {
    const installPath = resolve(packageDir, "install.sh");
    writeFileSync(installPath, unixInstallScript());
    chmodSync(installPath, 0o755);
  }

  cpSync(resolve(repoRoot, "LICENSE"), resolve(packageDir, "LICENSE"));
}

function readmeFor(target) {
  const binary = target.goos === "windows" ? "dcl-mcp.exe" : "dcl-mcp";
  const installCommand = target.goos === "windows" ? ".\\install.ps1" : "./install.sh";
  return `# DCL MCP Server

This archive contains the local stdio MCP server for Declarative Capability Language.

Target: ${target.goos}/${target.goarch}
Binary: ${binary}

## Install

You can run the binary directly from this extracted directory, or install it to a stable user-level path:

\`\`\`sh
${installCommand}
\`\`\`

The install script copies the binary to a predictable local location and prints MCP client configuration.

## VS Code / Copilot

Use \`mcp.vscode.json\` as the shape for VS Code MCP configuration. Replace the example command with the absolute path to your extracted or installed binary.

## Claude Desktop

Use \`mcp.claude-desktop.json\` as the shape for Claude Desktop MCP configuration. Replace the example command with the absolute path to your extracted or installed binary.

## Debug logs

Protocol messages are written to stdout. Human-readable debug logs are opt-in and are written to stderr only:

\`\`\`sh
DCL_MCP_DEBUG=1 ${target.goos === "windows" ? ".\\dcl-mcp.exe" : "./dcl-mcp"}
\`\`\`

## Tools

The server exposes compiler-backed tools: \`dcl_validate\`, \`dcl_compile\`, \`dcl_ir\`, \`dcl_explain_diagnostics\`, \`dcl_version\`, and \`dcl_summary\`.
`;
}

function vscodeConfigFor(target) {
  const command = exampleInstallPath(target);
  return `${JSON.stringify(
    {
      servers: {
        dcl: {
          type: "stdio",
          command,
        },
      },
    },
    null,
    2,
  )}\n`;
}

function claudeConfigFor(target) {
  const command = exampleInstallPath(target);
  return `${JSON.stringify(
    {
      mcpServers: {
        dcl: {
          command,
        },
      },
    },
    null,
    2,
  )}\n`;
}

function exampleInstallPath(target) {
  if (target.goos === "windows") {
    return "C:\\\\Users\\\\you\\\\.dcl\\\\bin\\\\dcl-mcp.exe";
  }
  if (target.goos === "linux") {
    return "/home/you/.dcl/bin/dcl-mcp";
  }
  return "/Users/you/.dcl/bin/dcl-mcp";
}

function unixInstallScript() {
  return `#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INSTALL_DIR="\${DCL_MCP_INSTALL_DIR:-$HOME/.dcl/bin}"
INSTALL_PATH="$INSTALL_DIR/dcl-mcp"

mkdir -p "$INSTALL_DIR"
cp "$SCRIPT_DIR/dcl-mcp" "$INSTALL_PATH"
chmod +x "$INSTALL_PATH"

cat <<EOF
DCL MCP server installed at:
  $INSTALL_PATH

VS Code / Copilot MCP configuration:
{
  "servers": {
    "dcl": {
      "type": "stdio",
      "command": "$INSTALL_PATH"
    }
  }
}
EOF
`;
}

function windowsInstallScript() {
  return `$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = if ($env:DCL_MCP_INSTALL_DIR) { $env:DCL_MCP_INSTALL_DIR } else { Join-Path $env:USERPROFILE ".dcl\\bin" }
$InstallPath = Join-Path $InstallDir "dcl-mcp.exe"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item -Force (Join-Path $ScriptDir "dcl-mcp.exe") $InstallPath

Write-Host "DCL MCP server installed at:"
Write-Host "  $InstallPath"
Write-Host ""
Write-Host "VS Code / Copilot MCP configuration:"
@"
{
  "servers": {
    "dcl": {
      "type": "stdio",
      "command": "$($InstallPath.Replace('\\', '\\\\'))"
    }
  }
}
"@ | Write-Host
`;
}

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
