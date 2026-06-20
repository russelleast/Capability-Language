import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(extensionRoot, "..", "..");
const compilerRoot = path.join(repoRoot, "compiler");
const binDir = path.join(extensionRoot, "bin");
const binaryName = process.platform === "win32" ? "dcl-lsp.exe" : "dcl-lsp";
const output = path.join(binDir, binaryName);
const goCache = process.env.GOCACHE || path.join(os.tmpdir(), "dcl-go-build");

mkdirSync(binDir, { recursive: true });

const result = spawnSync("go", ["build", "-o", output, "./cmd/dcl-lsp"], {
  cwd: compilerRoot,
  env: { ...process.env, GOCACHE: goCache },
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Built ${output}`);
