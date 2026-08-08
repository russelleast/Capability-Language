import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const websiteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await import(path.join(websiteDir, "public", "compiler", "wasm_exec.js"));

const go = new globalThis.Go();
const bytes = fs.readFileSync(path.join(websiteDir, "public", "compiler", "dcl.wasm"));
const { instance } = await WebAssembly.instantiate(bytes, go.importObject);
void go.run(instance);

for (let attempt = 0; attempt < 100 && typeof globalThis.dclCompile !== "function"; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

if (typeof globalThis.dclCompile !== "function") {
  throw new Error("WASM compiler did not register dclCompile");
}

const compile = (source) => JSON.parse(globalThis.dclCompile(source));
const language10 = compile("language dcl 1.0\nshape Legacy { value: Text }");
const language11 = compile("language dcl 1.1\nshape Modern { value: Integer }");
const unavailable = compile("language dcl 1.0\nshape Invalid { value: Integer }");

if (!language10.ok || !language11.ok) {
  throw new Error(`WASM compiler rejected compatible input: ${JSON.stringify({ language10, language11 })}`);
}
if (unavailable.ok || !unavailable.diagnostics.some((item) => item.code === "DCL_VERSION_FEATURE_UNAVAILABLE")) {
  throw new Error(`WASM compiler did not enforce the DCL 1.0 contract: ${JSON.stringify(unavailable)}`);
}

console.log("WASM language 1.0/1.1 compatibility smoke passed.");
process.exit(0);

