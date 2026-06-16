export type Diagnostic = {
  severity: "error" | "warning" | "info";
  message: string;
  code?: string;
  line?: number;
  column?: number;
};

export type CompileResult = {
  ok: boolean;
  diagnostics: Diagnostic[];
  ir?: unknown;
};

type GoRuntime = {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
};

type WasmCompileFunction = (source: string) => string;

declare global {
  interface Window {
    Go?: new () => GoRuntime;
    dclCompile?: WasmCompileFunction;
  }
}

let compilerReady: Promise<WasmCompileFunction> | undefined;

export let browserCompilerAvailable = true;

export async function compileDcl(source: string): Promise<CompileResult> {
  const trimmed = source.trim();

  if (!trimmed) {
    return {
      ok: false,
      diagnostics: [
        {
          severity: "error",
          code: "DCL_PLAYGROUND_EMPTY_SOURCE",
          message: "Enter DCL source before compiling.",
        },
      ],
    };
  }

  try {
    const compile = await loadCompiler();
    const rawResult = compile(source);
    return normalizeCompileResult(JSON.parse(rawResult));
  } catch (error) {
    browserCompilerAvailable = false;
    return compilerUnavailableResult(error);
  }
}

async function loadCompiler(): Promise<WasmCompileFunction> {
  compilerReady ??= loadCompilerRuntime();
  return compilerReady;
}

async function loadCompilerRuntime(): Promise<WasmCompileFunction> {
  await loadScript(assetPath("compiler/wasm_exec.js"));

  if (!window.Go) {
    throw new Error("Go WASM runtime did not initialize.");
  }

  const go = new window.Go();
  const wasm = await instantiateCompilerWasm(go);
  void go.run(wasm.instance);
  await waitForCompileExport();

  if (!window.dclCompile) {
    throw new Error("DCL compiler function was not exported by WASM.");
  }

  browserCompilerAvailable = true;
  return window.dclCompile;
}

async function instantiateCompilerWasm(go: GoRuntime): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
  const url = assetPath("compiler/dcl.wasm");

  try {
    return await WebAssembly.instantiateStreaming(fetch(url), go.importObject);
  } catch {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    const bytes = await response.arrayBuffer();
    return WebAssembly.instantiate(bytes, go.importObject);
  }
}

function waitForCompileExport(): Promise<void> {
  if (window.dclCompile) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;

      if (window.dclCompile) {
        window.clearInterval(interval);
        resolve();
        return;
      }

      if (attempts > 50) {
        window.clearInterval(interval);
        reject(new Error("DCL compiler function was not exported by WASM."));
      }
    }, 10);
  });
}

function assetPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${base}/${path}`;
}

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[data-dcl-wasm-runtime="${src}"]`);
  if (existing) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.dclWasmRuntime = src;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.append(script);
  });
}

function normalizeCompileResult(value: unknown): CompileResult {
  if (!value || typeof value !== "object") {
    throw new Error("DCL compiler returned an invalid result.");
  }

  const result = value as CompileResult;
  return {
    ok: Boolean(result.ok),
    diagnostics: Array.isArray(result.diagnostics) ? result.diagnostics.map(normalizeDiagnostic) : [],
    ir: result.ir,
  };
}

function normalizeDiagnostic(diagnostic: Diagnostic): Diagnostic {
  return {
    severity: diagnostic.severity,
    message: diagnostic.message,
    code: diagnostic.code,
    line: diagnostic.line,
    column: diagnostic.column,
  };
}

function compilerUnavailableResult(error: unknown): CompileResult {
  const detail = error instanceof Error ? error.message : "Unknown WASM loading error.";

  return {
    ok: false,
    diagnostics: [
      {
        severity: "info",
        code: "DCL_PLAYGROUND_COMPILER_UNAVAILABLE",
        message: `Compiler is not available in the browser. ${detail}`,
      },
    ],
  };
}
