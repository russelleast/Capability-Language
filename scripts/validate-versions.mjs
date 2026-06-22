import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(import.meta.dirname, "..");
const versionPath = path.join(repoRoot, "version.json");
const extensionPackagePath = path.join(repoRoot, "tools", "vscode-extension", "package.json");
const compilerVersionPath = path.join(repoRoot, "compiler", "internal", "version", "version.go");
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

function readText(filePath, label) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${label} cannot be found at ${path.relative(repoRoot, filePath)}`);
    return "";
  }

  return fs.readFileSync(filePath, "utf8");
}

const versions = readJson(versionPath, "version.json");
const extensionPackage = readJson(extensionPackagePath, "VS Code extension package.json");
const compilerVersionSource = readText(compilerVersionPath, "compiler version source");
const websiteVersionConfig = readText(websiteVersionConfigPath, "website version config");

if (versions && extensionPackage && versions?.vscode?.version !== extensionPackage.version) {
  errors.push(
    `version.json.vscode.version (${versions?.vscode?.version ?? "missing"}) must match tools/vscode-extension/package.json version (${extensionPackage.version ?? "missing"})`,
  );
}

const compilerVersionMatch = compilerVersionSource.match(/CompilerVersion\s*=\s*"([^"]+)"/);
const compilerLanguageMatch = compilerVersionSource.match(/LanguageVersion\s*=\s*"([^"]+)"/);

if (!compilerVersionMatch) {
  errors.push("compiler/internal/version/version.go is missing CompilerVersion");
} else if (versions?.compiler?.version !== compilerVersionMatch[1]) {
  errors.push(
    `version.json.compiler.version (${versions?.compiler?.version ?? "missing"}) must match compiler reported version (${compilerVersionMatch[1]})`,
  );
}

if (!compilerLanguageMatch) {
  errors.push("compiler/internal/version/version.go is missing LanguageVersion");
} else if (versions?.language?.version !== compilerLanguageMatch[1]) {
  errors.push(
    `version.json.language.version (${versions?.language?.version ?? "missing"}) must match compiler supported language version (${compilerLanguageMatch[1]})`,
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
