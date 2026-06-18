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
  { goos: "darwin", goarch: "arm64", output: "dcl-darwin-arm64" },
  { goos: "darwin", goarch: "amd64", output: "dcl-darwin-x64" },
  { goos: "linux", goarch: "amd64", output: "dcl-linux-x64" },
  { goos: "windows", goarch: "amd64", output: "dcl-win32-x64.exe" },
];

mkdirSync(binDir, { recursive: true });

for (const target of targets) {
  const output = resolve(binDir, target.output);
  const result = spawnSync("go", ["build", "-trimpath", "-o", output, "./cmd/dcl"], {
    cwd: compilerDir,
    env: {
      ...process.env,
      CGO_ENABLED: "0",
      GOOS: target.goos,
      GOARCH: target.goarch,
    },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  if (!target.output.endsWith(".exe")) {
    chmodSync(output, 0o755);
  }
}
