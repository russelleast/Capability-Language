import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const versionPath = path.join(repoRoot, "version.json");
const extensionPackagePath = path.join(repoRoot, "tools", "vscode-extension", "package.json");

function fail(message) {
  console.error(`Marketplace version check failed: ${message}`);
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

function containsVersion(value, targetVersion) {
  if (value === targetVersion) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsVersion(item, targetVersion));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => containsVersion(item, targetVersion));
  }

  return false;
}

const versions = readJson(versionPath, "version.json");
const extensionPackage = readJson(extensionPackagePath, "VS Code extension package.json");
const vscodeVersion = versions?.vscode?.version;

if (!vscodeVersion) {
  fail("version.json.vscode.version is missing");
}

if (extensionPackage.version !== vscodeVersion) {
  fail(`package.json version (${extensionPackage.version}) does not match version.json.vscode.version (${vscodeVersion})`);
}

const itemName = `${extensionPackage.publisher}.${extensionPackage.name}`;
const result = spawnSync("npx", ["vsce", "show", itemName, "--json"], {
  cwd: path.dirname(extensionPackagePath),
  encoding: "utf8",
});

if (result.status !== 0) {
  fail(`could not query ${itemName} on the VS Code Marketplace: ${result.stderr || result.stdout}`);
}

let marketplace;
try {
  marketplace = JSON.parse(result.stdout);
} catch (error) {
  fail(`vsce returned non-JSON Marketplace metadata: ${error.message}`);
}

if (containsVersion(marketplace?.versions, vscodeVersion) || marketplace?.version === vscodeVersion) {
  fail(`${itemName} version ${vscodeVersion} already exists on the VS Code Marketplace. Bump version.json.vscode.version before publishing.`);
}

console.log(`${itemName} version ${vscodeVersion} is not present on the VS Code Marketplace.`);
