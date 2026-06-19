import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extensionDir = resolve(scriptDir, "..");
const repoRoot = resolve(extensionDir, "..", "..");
const compilerDir = resolve(repoRoot, "compiler");
const binDir = resolve(extensionDir, "bin");

const targets = [
  { goos: "darwin", goarch: "arm64", suffix: "darwin-arm64", extension: "" },
  { goos: "darwin", goarch: "amd64", suffix: "darwin-x64", extension: "" },
  { goos: "linux", goarch: "amd64", suffix: "linux-x64", extension: "" },
  { goos: "windows", goarch: "amd64", suffix: "win32-x64", extension: ".exe" },
];

mkdirSync(binDir, { recursive: true });

for (const target of targets) {
  buildGoBinary(target, "dcl", "./cmd/dcl");
  buildGoBinary(target, "dcl-lsp", "./cmd/dcl-lsp");
}

function buildGoBinary(target, name, packagePath) {
  const outputName = `${name}-${target.suffix}${target.extension}`;
  const output = resolve(binDir, outputName);
  const result = spawnSync("go", ["build", "-trimpath", "-o", output, packagePath], {
    cwd: compilerDir,
    env: {
      ...process.env,
      CGO_ENABLED: "0",
      GOOS: target.goos,
      GOARCH: target.goarch,
    },
    stdio: "inherit",
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
  if (!outputName.endsWith(".exe")) {
    chmodSync(output, 0o755);
  }
}
