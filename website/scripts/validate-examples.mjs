import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const websiteDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(websiteDir, "..");
const compilerDir = path.join(repoDir, "compiler");

const examples = [
  single("hello-world"),
  single("register-customer"),
  single("leave-request"),
  single("payment-processing"),
  single("supervising-lifecycle"),
  single("policy-example"),
  single("agentic-customer-support"),
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
  console.error("\n[validate:examples] One or more published DCL examples failed validation.");
  process.exit(1);
}

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
