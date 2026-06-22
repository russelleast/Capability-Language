import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const versionPath = path.join(repoRoot, "version.json");
const extensionPackagePath = path.join(repoRoot, "tools", "vscode-extension", "package.json");
const websiteVersionConfigPath = path.join(repoRoot, "website", "src", "config", "version.ts");

const errors = [];

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${label} cannot be found at ${path.relative(repoRoot, filePath)}`);
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${label} is not valid JSON: ${error.message}`);
    return null;
  }
}

const versions = readJson(versionPath, "version.json");
const extensionPackage = readJson(extensionPackagePath, "VS Code extension package.json");
const websiteVersionConfig = fs.existsSync(websiteVersionConfigPath)
  ? fs.readFileSync(websiteVersionConfigPath, "utf8")
  : "";

if (!websiteVersionConfig) {
  errors.push(`website version config cannot be found at ${path.relative(repoRoot, websiteVersionConfigPath)}`);
}

if (versions && extensionPackage && versions?.vscode?.version !== extensionPackage.version) {
  errors.push(
    `version.json.vscode.version (${versions?.vscode?.version ?? "missing"}) must match tools/vscode-extension/package.json version (${extensionPackage.version ?? "missing"})`,
  );
}

if (!versions?.language?.name || !versions?.language?.version) {
  errors.push("version.json.language must include name and version");
}

if (!versions?.compiler?.name || !versions?.compiler?.version || !versions?.compiler?.supports) {
  errors.push("version.json.compiler must include name, version, and supports");
}

if (versions?.compiler?.supports !== versions?.language?.version) {
  errors.push(
    `version.json.compiler.supports (${versions?.compiler?.supports ?? "missing"}) must match version.json.language.version (${versions?.language?.version ?? "missing"})`,
  );
}

if (versions?.vscode?.compiler !== versions?.compiler?.version) {
  errors.push(
    `version.json.vscode.compiler (${versions?.vscode?.compiler ?? "missing"}) must match version.json.compiler.version (${versions?.compiler?.version ?? "missing"})`,
  );
}

if (!websiteVersionConfig.includes("version.language.version")) {
  errors.push("website version display should read the language version from root version.json");
}

if (errors.length > 0) {
  console.error("Version validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Version validation passed.");
