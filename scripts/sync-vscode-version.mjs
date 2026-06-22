import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const versionPath = path.join(repoRoot, "version.json");
const extensionPackagePath = path.join(repoRoot, "tools", "vscode-extension", "package.json");

function fail(message) {
  console.error(`Version sync failed: ${message}`);
  process.exit(1);
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} cannot be found at ${path.relative(repoRoot, filePath)}`);
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

const versions = readJson(versionPath, "version.json");
const vscodeVersion = versions?.vscode?.version;

if (!vscodeVersion) {
  fail("version.json.vscode.version is missing");
}

const extensionPackage = readJson(extensionPackagePath, "VS Code extension package.json");
const previousVersion = extensionPackage.version;
extensionPackage.version = vscodeVersion;

fs.writeFileSync(extensionPackagePath, `${JSON.stringify(extensionPackage, null, 2)}\n`);
console.log(`Synced VS Code extension package version: ${previousVersion} -> ${vscodeVersion}`);
