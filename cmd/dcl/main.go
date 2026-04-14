package main

import (
	"encoding/json"
	"fmt"
	"os"

	"capabilitylanguage/internal/compiler"
	"capabilitylanguage/internal/diagnostic"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}

	switch os.Args[1] {
	case "check":
		runCheck(os.Args[2:])
	case "ir":
		runIR(os.Args[2:])
	default:
		usage()
		os.Exit(2)
	}
}

func runCheck(args []string) {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "dcl check requires at least one .dcl file")
		os.Exit(2)
	}
	result := compiler.CompileFiles(args)
	if len(result.Diagnostics) == 0 {
		fmt.Fprintln(os.Stdout, "ok")
		return
	}
	diagnostic.WriteHuman(os.Stderr, result.Diagnostics)
	if compiler.HasErrors(result.Diagnostics) {
		os.Exit(1)
	}
}

func runIR(args []string) {
	files, ok := parseIRArgs(args)
	if !ok || len(files) == 0 {
		fmt.Fprintln(os.Stderr, "usage: dcl ir <files...> [--format json]")
		os.Exit(2)
	}
	result := compiler.CompileFiles(files)
	if compiler.HasErrors(result.Diagnostics) {
		diagnostic.WriteHuman(os.Stderr, result.Diagnostics)
		os.Exit(1)
	}
	out, err := compiler.MarshalIR(result.IR)
	if err != nil {
		encoded, _ := json.Marshal(result.IR)
		out = encoded
	}
	fmt.Fprintln(os.Stdout, string(out))
}

func parseIRArgs(args []string) ([]string, bool) {
	var files []string
	for i := 0; i < len(args); i++ {
		if args[i] == "--format" {
			if i+1 >= len(args) || args[i+1] != "json" {
				return nil, false
			}
			i++
			continue
		}
		files = append(files, args[i])
	}
	return files, true
}

func usage() {
	fmt.Fprintln(os.Stderr, "usage:")
	fmt.Fprintln(os.Stderr, "  dcl check <files...>")
	fmt.Fprintln(os.Stderr, "  dcl ir <files...> [--format json]")
}
