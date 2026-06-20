package lsp

import (
	"encoding/json"
	"sort"
	"time"

	"capabilitylanguage/internal/diagnostic"
)

type DiagnosticPublisher struct {
	send func(method string, params any) error
}

func NewDiagnosticPublisher(send func(method string, params any) error) *DiagnosticPublisher {
	return &DiagnosticPublisher{send: send}
}

func (p *DiagnosticPublisher) Publish(uri string, diagnostics []LSPDiagnostic) error {
	return p.send("textDocument/publishDiagnostics", publishDiagnosticsParams{
		URI:         uri,
		Diagnostics: diagnostics,
	})
}

func (p *DiagnosticPublisher) PublishValidationStatus(result ValidationResult) error {
	timestamp := ""
	if !result.LastValidationTimestamp.IsZero() {
		timestamp = result.LastValidationTimestamp.Format(time.RFC3339Nano)
	}
	return p.send("dcl/validationStatus", validationStatusParams{
		DiagnosticsCount:        result.DiagnosticsCount,
		LastValidationTimestamp: timestamp,
	})
}

func DiagnosticsByURI(items []diagnostic.Diagnostic, pathToURI map[string]string) map[string][]LSPDiagnostic {
	grouped := map[string][]LSPDiagnostic{}
	for _, item := range items {
		uri := pathToURI[item.Span.File]
		if uri == "" {
			continue
		}
		grouped[uri] = append(grouped[uri], ToLSPDiagnostic(item))
	}
	for _, diagnostics := range grouped {
		sort.SliceStable(diagnostics, func(i, j int) bool {
			if diagnostics[i].Range.Start.Line != diagnostics[j].Range.Start.Line {
				return diagnostics[i].Range.Start.Line < diagnostics[j].Range.Start.Line
			}
			if diagnostics[i].Range.Start.Character != diagnostics[j].Range.Start.Character {
				return diagnostics[i].Range.Start.Character < diagnostics[j].Range.Start.Character
			}
			return diagnostics[i].Code < diagnostics[j].Code
		})
	}
	return grouped
}

func ToLSPDiagnostic(item diagnostic.Diagnostic) LSPDiagnostic {
	return LSPDiagnostic{
		Range:    RangeFromSpan(item.Span),
		Severity: diagnosticSeverity(item.Severity),
		Code:     item.Code,
		Source:   "dcl",
		Message:  item.Message,
	}
}

func RangeFromSpan(span diagnostic.Span) Range {
	line := span.Line - 1
	if line < 0 {
		line = 0
	}
	column := span.Column - 1
	if column < 0 {
		column = 0
	}
	return Range{
		Start: Position{Line: line, Character: column},
		End:   Position{Line: line, Character: column + 1},
	}
}

func diagnosticSeverity(severity diagnostic.Severity) int {
	switch severity {
	case diagnostic.Error:
		return 1
	case diagnostic.Warning:
		return 2
	default:
		return 3
	}
}

type publishDiagnosticsParams struct {
	URI         string          `json:"uri"`
	Diagnostics []LSPDiagnostic `json:"diagnostics"`
}

type validationStatusParams struct {
	DiagnosticsCount        int    `json:"diagnosticsCount"`
	LastValidationTimestamp string `json:"lastValidationTimestamp,omitempty"`
}

type LSPDiagnostic struct {
	Range    Range  `json:"range"`
	Severity int    `json:"severity,omitempty"`
	Code     string `json:"code,omitempty"`
	Source   string `json:"source,omitempty"`
	Message  string `json:"message"`
}

type Range struct {
	Start Position `json:"start"`
	End   Position `json:"end"`
}

type Position struct {
	Line      int `json:"line"`
	Character int `json:"character"`
}

func DecodePublishDiagnostics(payload []byte) (publishDiagnosticsParams, bool) {
	var message struct {
		Method string                   `json:"method"`
		Params publishDiagnosticsParams `json:"params"`
	}
	if err := json.Unmarshal(payload, &message); err != nil || message.Method != "textDocument/publishDiagnostics" {
		return publishDiagnosticsParams{}, false
	}
	return message.Params, true
}
