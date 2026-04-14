package diagnostic

import (
	"fmt"
	"io"
	"sort"
)

type Severity string

const (
	Error   Severity = "error"
	Warning Severity = "warning"
	Info    Severity = "info"
)

type Span struct {
	File   string `json:"file,omitempty"`
	Line   int    `json:"line,omitempty"`
	Column int    `json:"column,omitempty"`
}

type Diagnostic struct {
	Code     string   `json:"code"`
	Severity Severity `json:"severity"`
	Message  string   `json:"message"`
	Span     Span     `json:"span,omitempty"`
	Node     string   `json:"node,omitempty"`
}

type Bag struct {
	items []Diagnostic
}

func (b *Bag) Add(sev Severity, code, msg string, span Span, node string) {
	b.items = append(b.items, Diagnostic{
		Code:     code,
		Severity: sev,
		Message:  msg,
		Span:     span,
		Node:     node,
	})
}

func (b *Bag) Error(code, msg string, span Span, node string) {
	b.Add(Error, code, msg, span, node)
}

func (b *Bag) Warning(code, msg string, span Span, node string) {
	b.Add(Warning, code, msg, span, node)
}

func (b *Bag) Items() []Diagnostic {
	out := append([]Diagnostic(nil), b.items...)
	sort.SliceStable(out, func(i, j int) bool {
		a, c := out[i], out[j]
		if a.Span.File != c.Span.File {
			return a.Span.File < c.Span.File
		}
		if a.Span.Line != c.Span.Line {
			return a.Span.Line < c.Span.Line
		}
		if a.Span.Column != c.Span.Column {
			return a.Span.Column < c.Span.Column
		}
		return a.Code < c.Code
	})
	return out
}

func (b *Bag) HasErrors() bool {
	for _, item := range b.items {
		if item.Severity == Error {
			return true
		}
	}
	return false
}

func WriteHuman(w io.Writer, diags []Diagnostic) {
	for _, d := range diags {
		loc := d.Span.File
		if d.Span.Line > 0 {
			loc = fmt.Sprintf("%s:%d:%d", d.Span.File, d.Span.Line, d.Span.Column)
		}
		if loc == "" {
			loc = "-"
		}
		if d.Node != "" {
			fmt.Fprintf(w, "%s %s %s: %s (%s)\n", loc, d.Severity, d.Code, d.Message, d.Node)
			continue
		}
		fmt.Fprintf(w, "%s %s %s: %s\n", loc, d.Severity, d.Code, d.Message)
	}
}
