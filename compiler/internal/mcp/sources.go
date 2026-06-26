package mcp

import (
	"capabilitylanguage/internal/compiler"
	"capabilitylanguage/internal/source"
)

func LoadSources(args sourceToolArgs) ([]compiler.SourceFile, error) {
	return source.Load(source.Request{
		Source:   args.Source,
		Filename: args.Filename,
		Path:     args.Path,
		Paths:    args.Paths,
	})
}
