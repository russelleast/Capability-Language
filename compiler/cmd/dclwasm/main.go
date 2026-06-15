//go:build js && wasm

package main

import (
	"encoding/json"
	"syscall/js"

	"capabilitylanguage/internal/compiler"
	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/ir"
)

type wasmResult struct {
	OK          bool             `json:"ok"`
	Diagnostics []wasmDiagnostic `json:"diagnostics"`
	IR          *ir.ProgramIR    `json:"ir,omitempty"`
}

type wasmDiagnostic struct {
	Severity string `json:"severity"`
	Message  string `json:"message"`
	Code     string `json:"code,omitempty"`
	Line     int    `json:"line,omitempty"`
	Column   int    `json:"column,omitempty"`
}

func main() {
	js.Global().Set("dclCompile", js.FuncOf(compileDCL))
	select {}
}

func compileDCL(_ js.Value, args []js.Value) any {
	source := ""
	if len(args) > 0 {
		source = args[0].String()
	}

	result := compiler.CompileSource("playground.dcl", source)
	ok := !compiler.HasErrors(result.Diagnostics)
	out := wasmResult{
		OK:          ok,
		Diagnostics: diagnostics(result.Diagnostics),
	}
	if ok {
		out.IR = &result.IR
	}

	encoded, err := json.Marshal(out)
	if err != nil {
		fallback, _ := json.Marshal(wasmResult{
			OK: false,
			Diagnostics: []wasmDiagnostic{
				{
					Severity: "error",
					Code:     "DCL_PLAYGROUND_RESULT_ENCODE_FAILED",
					Message:  err.Error(),
				},
			},
		})
		return string(fallback)
	}

	return string(encoded)
}

func diagnostics(items []diagnostic.Diagnostic) []wasmDiagnostic {
	out := make([]wasmDiagnostic, 0, len(items))
	for _, item := range items {
		out = append(out, wasmDiagnostic{
			Severity: string(item.Severity),
			Message:  item.Message,
			Code:     item.Code,
			Line:     item.Span.Line,
			Column:   item.Span.Column,
		})
	}
	return out
}
