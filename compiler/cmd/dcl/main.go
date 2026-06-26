package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"capabilitylanguage/internal/compiler"
	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/source"
	"capabilitylanguage/internal/summary"
	"capabilitylanguage/internal/version"
)

type analysisEnvelope struct {
	OK              bool                    `json:"ok"`
	Diagnostics     []diagnostic.Diagnostic `json:"diagnostics"`
	DiagnosticCount int                     `json:"diagnosticCount"`
	ErrorCount      int                     `json:"errorCount"`
	WarningCount    int                     `json:"warningCount"`
	SourceCount     int                     `json:"sourceCount"`
	IR              any                     `json:"ir,omitempty"`
	Summary         any                     `json:"summary,omitempty"`
	Version         any                     `json:"version,omitempty"`
	Explanations    []diagnosticExplanation `json:"explanations,omitempty"`
}

type diagnosticExplanation struct {
	Code        string              `json:"code"`
	Severity    diagnostic.Severity `json:"severity"`
	Span        diagnostic.Span     `json:"span,omitempty"`
	Node        string              `json:"node,omitempty"`
	Message     string              `json:"message"`
	Explanation string              `json:"explanation"`
}

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		usage(stderr)
		return 2
	}

	switch args[0] {
	case "version", "--version":
		return runVersion(args[1:], stdout, stderr)
	case "check", "validate":
		return runValidate(args[1:], stdout, stderr)
	case "compile":
		return runCompile(args[1:], stdout, stderr)
	case "ir":
		return runIR(args[1:], stdout, stderr)
	case "summary":
		return runSummary(args[1:], stdout, stderr)
	case "explain-diagnostics":
		return runExplainDiagnostics(args[1:], stdout, stderr)
	default:
		usage(stderr)
		return 2
	}
}

func runVersion(args []string, stdout, stderr io.Writer) int {
	jsonOut, ok := parseOnlyJSON(args)
	if !ok {
		fmt.Fprintln(stderr, "usage: dcl version [--json]")
		return 2
	}
	metadata, err := version.Current()
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 1
	}
	if jsonOut {
		writeJSON(stdout, map[string]any{"version": metadata, "summary": version.Summary()})
		return 0
	}
	fmt.Fprintln(stdout, version.Summary())
	return 0
}

func runValidate(args []string, stdout, stderr io.Writer) int {
	paths, jsonOut, ok := parsePathArgs(args)
	if !ok || len(paths) == 0 {
		fmt.Fprintln(stderr, "usage: dcl validate <paths...> [--json]")
		return 2
	}
	result, sourceCount, err := compilePaths(paths)
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 1
	}
	if jsonOut {
		writeJSON(stdout, envelope(result, sourceCount))
		return exitForDiagnostics(result.Diagnostics)
	}
	if len(result.Diagnostics) == 0 {
		fmt.Fprintf(stdout, "ok (DCL language %s)\n", result.IR.Version.Language)
		return 0
	}
	diagnostic.WriteHuman(stderr, result.Diagnostics)
	return exitForDiagnostics(result.Diagnostics)
}

func runCompile(args []string, stdout, stderr io.Writer) int {
	paths, jsonOut, ok := parsePathArgs(args)
	if !ok || len(paths) == 0 {
		fmt.Fprintln(stderr, "usage: dcl compile <paths...> [--json]")
		return 2
	}
	result, sourceCount, err := compilePaths(paths)
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 1
	}
	out := envelope(result, sourceCount)
	if metadata, err := version.Current(); err == nil {
		out.Version = metadata
	}
	if jsonOut {
		writeJSON(stdout, out)
		return exitForDiagnostics(result.Diagnostics)
	}
	if len(result.Diagnostics) > 0 {
		diagnostic.WriteHuman(stderr, result.Diagnostics)
	}
	if compiler.HasErrors(result.Diagnostics) {
		return 1
	}
	fmt.Fprintf(stdout, "compiled ok (sources: %d, DCL language %s)\n", sourceCount, result.IR.Version.Language)
	return 0
}

func runIR(args []string, stdout, stderr io.Writer) int {
	paths, jsonOut, legacyFormat, ok := parseIRCommandArgs(args)
	if !ok || len(paths) == 0 {
		fmt.Fprintln(stderr, "usage: dcl ir <paths...> [--json|--format json]")
		return 2
	}
	result, sourceCount, err := compilePaths(paths)
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 1
	}
	if jsonOut {
		out := envelope(result, sourceCount)
		out.IR = result.IR
		writeJSON(stdout, out)
		return exitForDiagnostics(result.Diagnostics)
	}
	if compiler.HasErrors(result.Diagnostics) {
		diagnostic.WriteHuman(stderr, result.Diagnostics)
		return 1
	}
	if legacyFormat {
		writeJSON(stdout, result.IR)
		return 0
	}
	writeJSON(stdout, result.IR)
	return 0
}

func runSummary(args []string, stdout, stderr io.Writer) int {
	paths, jsonOut, ok := parsePathArgs(args)
	if !ok || len(paths) == 0 {
		fmt.Fprintln(stderr, "usage: dcl summary <paths...> [--json]")
		return 2
	}
	result, sourceCount, err := compilePaths(paths)
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 1
	}
	model := summary.FromIR(result.IR)
	if jsonOut {
		out := envelope(result, sourceCount)
		out.Summary = model
		writeJSON(stdout, out)
		return exitForDiagnostics(result.Diagnostics)
	}
	if compiler.HasErrors(result.Diagnostics) {
		diagnostic.WriteHuman(stderr, result.Diagnostics)
		return 1
	}
	writeJSON(stdout, model)
	return 0
}

func runExplainDiagnostics(args []string, stdout, stderr io.Writer) int {
	paths, jsonOut, ok := parsePathArgs(args)
	if !ok || len(paths) == 0 {
		fmt.Fprintln(stderr, "usage: dcl explain-diagnostics <paths...|json-file> [--json]")
		return 2
	}
	diagnostics, sourceCount, err := diagnosticsFromArgs(paths)
	if err != nil {
		fmt.Fprintln(stderr, err)
		return 1
	}
	explanations := explainDiagnostics(diagnostics)
	if jsonOut {
		writeJSON(stdout, analysisEnvelope{
			OK:              !hasDiagnosticErrors(diagnostics),
			Diagnostics:     diagnostics,
			DiagnosticCount: len(diagnostics),
			ErrorCount:      countSeverity(diagnostics, diagnostic.Error),
			WarningCount:    countSeverity(diagnostics, diagnostic.Warning),
			SourceCount:     sourceCount,
			Explanations:    explanations,
		})
		return exitForDiagnostics(diagnostics)
	}
	if len(explanations) == 0 {
		fmt.Fprintln(stdout, "no diagnostics")
		return 0
	}
	for _, item := range explanations {
		fmt.Fprintln(stdout, item.Explanation)
	}
	return exitForDiagnostics(diagnostics)
}

func compilePaths(paths []string) (compiler.Result, int, error) {
	sources, err := source.LoadPaths(paths)
	if err != nil {
		return compiler.Result{}, 0, err
	}
	return compiler.CompileSources(sources), len(sources), nil
}

func diagnosticsFromArgs(paths []string) ([]diagnostic.Diagnostic, int, error) {
	if len(paths) == 1 && filepath.Ext(paths[0]) == ".json" {
		payload, err := os.ReadFile(paths[0])
		if err != nil {
			return nil, 0, err
		}
		diagnostics, err := decodeDiagnostics(payload)
		return diagnostics, 0, err
	}
	result, sourceCount, err := compilePaths(paths)
	if err != nil {
		return nil, 0, err
	}
	return result.Diagnostics, sourceCount, nil
}

func decodeDiagnostics(payload []byte) ([]diagnostic.Diagnostic, error) {
	var list []diagnostic.Diagnostic
	if err := json.Unmarshal(payload, &list); err == nil {
		return list, nil
	}
	var object struct {
		Diagnostics []diagnostic.Diagnostic `json:"diagnostics"`
	}
	if err := json.Unmarshal(payload, &object); err != nil {
		return nil, err
	}
	return object.Diagnostics, nil
}

func envelope(result compiler.Result, sourceCount int) analysisEnvelope {
	return analysisEnvelope{
		OK:              !compiler.HasErrors(result.Diagnostics),
		Diagnostics:     result.Diagnostics,
		DiagnosticCount: len(result.Diagnostics),
		ErrorCount:      countSeverity(result.Diagnostics, diagnostic.Error),
		WarningCount:    countSeverity(result.Diagnostics, diagnostic.Warning),
		SourceCount:     sourceCount,
	}
}

func parseOnlyJSON(args []string) (bool, bool) {
	jsonOut := false
	for _, arg := range args {
		if arg != "--json" {
			return false, false
		}
		jsonOut = true
	}
	return jsonOut, true
}

func parsePathArgs(args []string) ([]string, bool, bool) {
	var paths []string
	jsonOut := false
	for _, arg := range args {
		switch arg {
		case "--json":
			jsonOut = true
		default:
			paths = append(paths, arg)
		}
	}
	return paths, jsonOut, true
}

func parseIRCommandArgs(args []string) ([]string, bool, bool, bool) {
	var paths []string
	jsonOut := false
	legacyFormat := false
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--json":
			jsonOut = true
		case "--format":
			if i+1 >= len(args) || args[i+1] != "json" {
				return nil, false, false, false
			}
			legacyFormat = true
			i++
		default:
			paths = append(paths, args[i])
		}
	}
	return paths, jsonOut, legacyFormat, true
}

func writeJSON(w io.Writer, value any) {
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		encoded, _ = json.Marshal(value)
	}
	fmt.Fprintln(w, string(encoded))
}

func exitForDiagnostics(items []diagnostic.Diagnostic) int {
	if hasDiagnosticErrors(items) {
		return 1
	}
	return 0
}

func hasDiagnosticErrors(items []diagnostic.Diagnostic) bool {
	for _, item := range items {
		if item.Severity == diagnostic.Error {
			return true
		}
	}
	return false
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

func explainDiagnostics(items []diagnostic.Diagnostic) []diagnosticExplanation {
	out := make([]diagnosticExplanation, 0, len(items))
	for _, item := range items {
		out = append(out, diagnosticExplanation{
			Code:        item.Code,
			Severity:    item.Severity,
			Span:        item.Span,
			Node:        item.Node,
			Message:     item.Message,
			Explanation: explainDiagnostic(item),
		})
	}
	return out
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

func usage(w io.Writer) {
	lines := []string{
		"usage:",
		"  dcl version [--json]",
		"  dcl validate <paths...> [--json]",
		"  dcl check <paths...> [--json]",
		"  dcl compile <paths...> [--json]",
		"  dcl ir <paths...> [--json|--format json]",
		"  dcl summary <paths...> [--json]",
		"  dcl explain-diagnostics <paths...|json-file> [--json]",
	}
	fmt.Fprintln(w, strings.Join(lines, "\n"))
}
