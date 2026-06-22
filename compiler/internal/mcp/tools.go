package mcp

import (
	"encoding/json"
	"fmt"

	"capabilitylanguage/internal/compiler"
	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/version"
)

type Tool struct {
	Name        string         `json:"name"`
	Title       string         `json:"title,omitempty"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
}

type toolResult struct {
	Content           []textContent `json:"content"`
	StructuredContent any           `json:"structuredContent,omitempty"`
	IsError           bool          `json:"isError,omitempty"`
}

type textContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type sourceToolArgs struct {
	Source   string   `json:"source,omitempty"`
	Filename string   `json:"filename,omitempty"`
	Path     string   `json:"path,omitempty"`
	Paths    []string `json:"paths,omitempty"`
}

type explainDiagnosticsArgs struct {
	Diagnostics []diagnostic.Diagnostic `json:"diagnostics"`
}

func Tools() []Tool {
	return []Tool{
		{
			Name:        "dcl_validate",
			Title:       "Validate DCL",
			Description: "Validate supplied DCL source or explicit DCL file/workspace paths using the DCL compiler.",
			InputSchema: sourceInputSchema(),
		},
		{
			Name:        "dcl_compile",
			Title:       "Compile DCL",
			Description: "Compile supplied DCL source or explicit DCL file/workspace paths using the DCL compiler.",
			InputSchema: sourceInputSchema(),
		},
		{
			Name:        "dcl_ir",
			Title:       "Generate DCL IR",
			Description: "Return compiler IR for supplied DCL source or explicit DCL file/workspace paths.",
			InputSchema: sourceInputSchema(),
		},
		{
			Name:        "dcl_explain_diagnostics",
			Title:       "Explain DCL Diagnostics",
			Description: "Explain DCL compiler diagnostics in deterministic human-readable form.",
			InputSchema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"diagnostics": map[string]any{
						"type":        "array",
						"description": "DCL compiler diagnostics to explain.",
						"items":       map[string]any{"type": "object"},
					},
				},
				"required": []string{"diagnostics"},
			},
		},
		{
			Name:        "dcl_version",
			Title:       "DCL Version",
			Description: "Return DCL version metadata loaded from version.json.",
			InputSchema: map[string]any{
				"type":       "object",
				"properties": map[string]any{},
			},
		},
	}
}

func CallTool(name string, arguments json.RawMessage) (toolResult, error) {
	switch name {
	case "dcl_validate":
		return callValidate(arguments)
	case "dcl_compile":
		return callCompile(arguments)
	case "dcl_ir":
		return callIR(arguments)
	case "dcl_explain_diagnostics":
		return callExplainDiagnostics(arguments)
	case "dcl_version":
		return callVersion()
	default:
		return toolResult{}, fmt.Errorf("unknown tool %q", name)
	}
}

func callValidate(arguments json.RawMessage) (toolResult, error) {
	result, sourceCount, err := compileFromArgs(arguments)
	if err != nil {
		return errorResult(err), nil
	}
	content := map[string]any{
		"valid":           !compiler.HasErrors(result.Diagnostics),
		"diagnostics":     result.Diagnostics,
		"diagnosticCount": len(result.Diagnostics),
		"errorCount":      countSeverity(result.Diagnostics, diagnostic.Error),
		"warningCount":    countSeverity(result.Diagnostics, diagnostic.Warning),
		"sourceCount":     sourceCount,
	}
	return structuredResult(content), nil
}

func callCompile(arguments json.RawMessage) (toolResult, error) {
	result, sourceCount, err := compileFromArgs(arguments)
	if err != nil {
		return errorResult(err), nil
	}
	metadata, metadataErr := version.Current()
	content := map[string]any{
		"ok":              !compiler.HasErrors(result.Diagnostics),
		"diagnostics":     result.Diagnostics,
		"diagnosticCount": len(result.Diagnostics),
		"errorCount":      countSeverity(result.Diagnostics, diagnostic.Error),
		"warningCount":    countSeverity(result.Diagnostics, diagnostic.Warning),
		"sourceCount":     sourceCount,
	}
	if metadataErr == nil {
		content["version"] = metadata
	}
	return structuredResult(content), nil
}

func callIR(arguments json.RawMessage) (toolResult, error) {
	result, sourceCount, err := compileFromArgs(arguments)
	if err != nil {
		return errorResult(err), nil
	}
	content := map[string]any{
		"ok":              !compiler.HasErrors(result.Diagnostics),
		"diagnostics":     result.Diagnostics,
		"diagnosticCount": len(result.Diagnostics),
		"errorCount":      countSeverity(result.Diagnostics, diagnostic.Error),
		"warningCount":    countSeverity(result.Diagnostics, diagnostic.Warning),
		"sourceCount":     sourceCount,
		"ir":              result.IR,
	}
	return structuredResult(content), nil
}

func callExplainDiagnostics(arguments json.RawMessage) (toolResult, error) {
	var args explainDiagnosticsArgs
	if len(arguments) > 0 {
		if err := json.Unmarshal(arguments, &args); err != nil {
			return toolResult{}, err
		}
	}
	explanations := make([]map[string]any, 0, len(args.Diagnostics))
	for _, item := range args.Diagnostics {
		explanations = append(explanations, map[string]any{
			"code":        item.Code,
			"severity":    item.Severity,
			"span":        item.Span,
			"node":        item.Node,
			"message":     item.Message,
			"explanation": explainDiagnostic(item),
		})
	}
	return structuredResult(map[string]any{
		"diagnostics":  args.Diagnostics,
		"explanations": explanations,
		"count":        len(explanations),
	}), nil
}

func callVersion() (toolResult, error) {
	metadata, err := version.Current()
	if err != nil {
		return errorResult(err), nil
	}
	return structuredResult(map[string]any{
		"version": metadata,
		"summary": version.Summary(),
	}), nil
}

func compileFromArgs(arguments json.RawMessage) (compiler.Result, int, error) {
	var args sourceToolArgs
	if len(arguments) > 0 {
		if err := json.Unmarshal(arguments, &args); err != nil {
			return compiler.Result{}, 0, err
		}
	}
	sources, err := LoadSources(args)
	if err != nil {
		return compiler.Result{}, 0, err
	}
	return compiler.CompileSources(sources), len(sources), nil
}

func sourceInputSchema() map[string]any {
	return map[string]any{
		"type": "object",
		"properties": map[string]any{
			"source": map[string]any{
				"type":        "string",
				"description": "Inline DCL source text.",
			},
			"filename": map[string]any{
				"type":        "string",
				"description": "Display filename for inline source diagnostics.",
			},
			"path": map[string]any{
				"type":        "string",
				"description": "Explicit DCL file or directory path to read.",
			},
			"paths": map[string]any{
				"type":        "array",
				"description": "Explicit DCL file or directory paths to read.",
				"items":       map[string]any{"type": "string"},
			},
		},
	}
}

func structuredResult(value any) toolResult {
	payload, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		payload = []byte(`{"error":"failed to encode tool result"}`)
	}
	return toolResult{
		Content: []textContent{{
			Type: "text",
			Text: string(payload),
		}},
		StructuredContent: value,
	}
}

func errorResult(err error) toolResult {
	content := map[string]any{"error": err.Error()}
	result := structuredResult(content)
	result.IsError = true
	return result
}

func countSeverity(items []diagnostic.Diagnostic, severity diagnostic.Severity) int {
	count := 0
	for _, item := range items {
		if item.Severity == severity {
			count++
		}
	}
	return count
}

func explainDiagnostic(item diagnostic.Diagnostic) string {
	location := "the supplied DCL source"
	if item.Span.File != "" {
		location = item.Span.File
		if item.Span.Line > 0 {
			location = fmt.Sprintf("%s:%d:%d", location, item.Span.Line, item.Span.Column)
		}
	}
	target := ""
	if item.Node != "" {
		target = fmt.Sprintf(" The diagnostic is associated with %q.", item.Node)
	}
	return fmt.Sprintf("%s %s %s at %s: %s.%s", item.Severity, item.Code, severityAction(item.Severity), location, item.Message, target)
}

func severityAction(severity diagnostic.Severity) string {
	switch severity {
	case diagnostic.Error:
		return "prevents the DCL model from compiling"
	case diagnostic.Warning:
		return "identifies a model issue that should be reviewed"
	default:
		return "provides compiler information"
	}
}
