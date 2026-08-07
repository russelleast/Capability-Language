import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const websiteDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(websiteDir, "..");
const compilerDir = path.join(repoDir, "compiler");
const generatedDir = mkdtempSync(path.join(os.tmpdir(), "dcl-doc-examples-"));

const referenceSource = readFileSync(path.join(websiteDir, "src", "pages", "docs", "index.astro"), "utf8");
const referenceSnippets = [...referenceSource.matchAll(/<pre><code>\{`([\s\S]*?)`\}<\/code><\/pre>/g)].map(
  (match, index) => {
    const file = path.join(generatedDir, `reference-${index + 1}.dcl`);
    writeFileSync(file, `${match[1]}\n`);
    return {
      name: `reference-snippet-${index + 1}`,
      files: [file],
      expectedDiagnostic: match[1].includes("attempts: Integer min 1 max 5 default 10")
        ? "DCL_SEM_NUMERIC_DEFAULT_OUT_OF_RANGE"
        : undefined,
    };
  },
);

const examples = [
  ...referenceSnippets,
  single("domain-types"),
  single("hello-world"),
  single("register-customer"),
  single("leave-request"),
  single("payment-processing"),
  single("supervising-lifecycle"),
  single("policy-example"),
  single("agentic-customer-support"),
  single("ai-governance-screening"),
  single("reliability-policy"),
  single("authorisation"),
  single("observed-capability"),
  single("effects-and-integrations"),
  {
    name: "context-composition",
    files: ["context-shared.dcl", "context-sales.dcl"].map(examplePath),
  },
  {
    name: "ecommerce-platform",
    files: [
      "ecommerce/storefront/actors.dcl",
      "ecommerce/storefront/shapes.dcl",
      "ecommerce/storefront/policies.dcl",
      "ecommerce/storefront/browse-products.dcl",
      "ecommerce/storefront/basket.dcl",
      "ecommerce/storefront/checkout.dcl",
      "ecommerce/storefront/order.dcl",
      "ecommerce/warehouse/actors.dcl",
      "ecommerce/warehouse/fulfilment.dcl",
      "ecommerce/delivery/actors.dcl",
      "ecommerce/delivery/delivery.dcl",
      "ecommerce/order-lifecycle.dcl",
    ].map(examplePath),
  },
  {
    name: "ai-demo-workspace",
    files: [
      "ai-demo-workspace/domain.dcl",
      "ai-demo-workspace/policies.dcl",
      "ai-demo-workspace/capabilities.dcl",
      "ai-demo-workspace/lifecycle.dcl",
    ].map(examplePath),
  },
  {
    name: "type-system-invalid",
    files: [examplePath("type-system-invalid.dcl")],
    expectedDiagnostic: "DCL_SEM_NUMERIC_DEFAULT_OUT_OF_RANGE",
  },
];

let failed = false;

for (const example of examples) {
  const displayFiles = example.files.map((file) => path.relative(repoDir, file));
  console.log(`\n[validate:examples] ${example.name}`);
  for (const file of displayFiles) {
    console.log(`  - ${file}`);
  }

  const result = spawnSync("go", ["run", "./cmd/dcl", "check", ...example.files], {
    cwd: compilerDir,
    encoding: "utf8",
  });

  if (example.expectedDiagnostic) {
    const output = `${result.stdout}\n${result.stderr}`;
    if (result.status !== 0 && output.includes(example.expectedDiagnostic)) {
      console.log(`  PASS ${example.name} (rejected with ${example.expectedDiagnostic})`);
      continue;
    }

    failed = true;
    console.error(`  FAIL ${example.name} (expected ${example.expectedDiagnostic})`);
    if (result.stdout.trim()) console.error(indent(result.stdout.trim()));
    if (result.stderr.trim()) console.error(indent(result.stderr.trim()));
    continue;
  }

  if (result.status === 0) {
    console.log(`  PASS ${example.name}`);
    if (result.stdout.trim()) console.log(indent(result.stdout.trim()));
    continue;
  }

  failed = true;
  console.error(`  FAIL ${example.name}`);
  if (result.stdout.trim()) console.error(indent(result.stdout.trim()));
  if (result.stderr.trim()) console.error(indent(result.stderr.trim()));
}

if (failed) {
  rmSync(generatedDir, { recursive: true, force: true });
  console.error("\n[validate:examples] One or more published DCL examples failed validation.");
  process.exit(1);
}

rmSync(generatedDir, { recursive: true, force: true });
console.log("\n[validate:examples] All published DCL examples compile.");

function single(id) {
  return {
    name: id,
    files: [examplePath(`${id}.dcl`)],
  };
}

function examplePath(relativePath) {
  return path.join(websiteDir, "src", "examples", relativePath);
}

function indent(text) {
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}
