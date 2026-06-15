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

export const browserCompilerAvailable = false;

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

  return {
    ok: false,
    diagnostics: [
      {
        severity: "info",
        code: "DCL_PLAYGROUND_COMPILER_UNAVAILABLE",
        message:
          "Compiler is not available in the browser yet. This playground is ready for the future WASM compiler adapter, but v0.1 only supports loading and editing validated examples.",
      },
    ],
  };
}
