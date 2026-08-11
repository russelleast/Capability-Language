import { spawn } from "node:child_process";
import { resolve } from "node:path";

const binary = process.argv[2] ? resolve(process.argv[2]) : resolve("./bin/dcl-mcp");

const messages = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "dcl-mcp-smoke", version: "1.0" },
    },
  },
  {
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  },
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  },
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "dcl_version",
      arguments: {},
    },
  },
  {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "dcl_summary",
      arguments: {
        filename: "smoke.dcl",
        source: `language dcl 1.0

actor User is human

shape GreetingInput {
  name: Text required
}

capability SayHello {
  intent GreetingInput from User

  outcome GreetingPrepared

  when {
    always GreetingPrepared
  }
}`,
      },
    },
  },
  ...["dcl_validate", "dcl_compile", "dcl_ir"].map((name, index) => ({
    jsonrpc: "2.0",
    id: 5 + index,
    method: "tools/call",
    params: {
      name,
      arguments: {
        filename: "smoke.dcl",
        source: `language dcl 1.0

actor User is human

shape GreetingInput {
  name: Text required
}

capability SayHello {
  intent GreetingInput from User

  outcome GreetingPrepared

  when {
    always GreetingPrepared
  }
}`,
      },
    },
  })),
  {
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: {
      name: "dcl_explain_diagnostics",
      arguments: { diagnostics: [] },
    },
  },
];

const child = spawn(binary, [], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env },
});

let stdout = "";
let stderr = "";

child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdout += chunk;
});
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

const timeout = setTimeout(() => {
  child.kill("SIGTERM");
  fail(`Timed out waiting for ${binary}`);
}, 5000);

for (const message of messages) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}
child.stdin.end();

child.on("error", (error) => {
  clearTimeout(timeout);
  fail(error.message);
});

child.on("close", (code) => {
  clearTimeout(timeout);
  if (code !== 0) {
    fail(`Server exited with code ${code}\n${stderr}`);
  }

  const responses = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        fail(`Invalid JSON response line: ${line}\n${error.message}`);
      }
    });

  const byId = new Map(responses.map((response) => [response.id, response]));
  assert(byId.get(1)?.result?.protocolVersion === "2025-06-18", "initialize response missing protocol version");
  assert(Array.isArray(byId.get(2)?.result?.tools), "tools/list response missing tools");
  const toolNames = byId.get(2).result.tools.map((tool) => tool.name);
  for (const name of ["dcl_validate", "dcl_compile", "dcl_ir", "dcl_explain_diagnostics", "dcl_summary", "dcl_version"]) {
    assert(toolNames.includes(name), `tools/list missing ${name}`);
  }
  assert(byId.get(3)?.result?.structuredContent?.version?.compiler?.version, "dcl_version call missing version metadata");
  assert(Array.isArray(byId.get(3)?.result?.structuredContent?.version?.compiler?.supports), "dcl_version compiler.supports is not an array");
  assert(Array.isArray(byId.get(3)?.result?.structuredContent?.supportedLanguageVersions), "dcl_version supportedLanguageVersions is not an array");
  assert(byId.get(4)?.result?.structuredContent?.ok === true, "dcl_summary call did not succeed");
  assert(byId.get(4)?.result?.structuredContent?.summary?.capabilities?.[0]?.name === "SayHello", "dcl_summary missing SayHello capability");
  assert(byId.get(5)?.result?.structuredContent?.valid === true, "dcl_validate call did not succeed");
  assert(byId.get(6)?.result?.structuredContent?.ok === true, "dcl_compile call did not succeed");
  assert(byId.get(7)?.result?.structuredContent?.ok === true, "dcl_ir call did not succeed");
  assert(byId.get(7)?.result?.structuredContent?.ir, "dcl_ir call did not return IR");
  assert(byId.get(8)?.result?.structuredContent?.count === 0, "dcl_explain_diagnostics call did not succeed");

  console.log(`DCL MCP smoke test passed for ${binary}`);
});

function assert(condition, message) {
  if (!condition) fail(message);
}

function fail(message) {
  console.error(`DCL MCP smoke test failed: ${message}`);
  process.exit(1);
}
