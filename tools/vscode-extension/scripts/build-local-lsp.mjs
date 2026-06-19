import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const extensionDir = resolve(scriptDir, "..");
const repoRoot = resolve(extensionDir, "..", "..");
const compilerDir = resolve(repoRoot, "compiler");
const binDir = resolve(extensionDir, "bin");
const outputName = process.platform === "win32" ? "dcl-lsp.exe" : "dcl-lsp";
const output = resolve(binDir, outputName);

mkdirSync(binDir, { recursive: true });

const result = spawnSync("go", ["build", "-trimpath", "-o", output, "./cmd/dcl-lsp"], {
  cwd: compilerDir,
  env: {
    ...process.env,
    CGO_ENABLED: "0",
  },
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!outputName.endsWith(".exe")) {
  chmodSync(output, 0o755);
}

console.log(`Built ${output}`);
