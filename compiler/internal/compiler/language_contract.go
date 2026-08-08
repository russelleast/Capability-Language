package compiler

import (
	"fmt"
	"sort"
	"strings"

	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/lexer"
	"capabilitylanguage/internal/parser"
	"capabilitylanguage/internal/version"
)

// languageFeature is the compiler's catalogue of versioned language features.
// Parsing stays permissive enough to identify authored constructs; the selected
// language contract decides whether their semantics are available.
type languageFeature string

const (
	featureInteger           languageFeature = "Integer"
	featureMeasure           languageFeature = "measure declarations"
	featureMeasuredNumeric   languageFeature = "measured numeric types"
	featureNumericConstraint languageFeature = "numeric field constraints"
	featureEnumShape         languageFeature = "enum shapes"
	featureTypedEnumCase     languageFeature = "typed enum cases"
)

var featureIntroduced = map[languageFeature]string{
	featureInteger:           "1.1",
	featureMeasure:           "1.1",
	featureMeasuredNumeric:   "1.1",
	featureNumericConstraint: "1.1",
	featureEnumShape:         "1.1",
	featureTypedEnumCase:     "1.1",
}

type builtinTypeSpec struct {
	name       string
	introduced string
}

var builtinTypeSpecs = []builtinTypeSpec{
	{name: "Text", introduced: "1.0"},
	{name: "Boolean", introduced: "1.0"},
	{name: "Number", introduced: "1.0"},
	{name: "Date", introduced: "1.0"},
	{name: "DateTime", introduced: "1.0"},
	{name: "Uuid", introduced: "1.0"},
	{name: "Email", introduced: "1.0"},
	{name: "Money", introduced: "1.0"},
	{name: "Integer", introduced: "1.1"},
}

func isBuiltinType(name string) bool {
	for _, spec := range builtinTypeSpecs {
		if spec.name == name {
			return true
		}
	}
	return false
}

// BuiltinTypesForLanguage exposes the compiler-owned type catalogue to
// language tooling without making the LSP maintain a second type system.
func BuiltinTypesForLanguage(languageVersion string) []string {
	out := make([]string, 0, len(builtinTypeSpecs))
	for _, spec := range builtinTypeSpecs {
		if compareVersion(languageVersion, spec.introduced) >= 0 {
			out = append(out, spec.name)
		}
	}
	return out
}

// DeclaredLanguageVersion reads the authored declaration using the compiler's
// lexer and parser. A missing declaration retains the established latest-version
// fallback and is separately reported by the parser diagnostic.
func DeclaredLanguageVersion(source string) string {
	tokens, _ := lexer.Lex("document.dcl", source)
	program, _ := parser.Parse(tokens)
	for _, decl := range program.Languages {
		if decl.Name == version.LanguageName() {
			return decl.Version
		}
	}
	return version.LatestLanguageVersion()
}

func (c *compiler) selectLanguageContract() {
	supported := version.SupportedLanguageVersions()
	supportedSet := map[string]bool{}
	for _, item := range supported {
		supportedSet[item] = true
	}

	byFile := map[string]string{}
	for _, decl := range c.program.Languages {
		if decl.Name != version.LanguageName() {
			continue
		}
		if !supportedSet[decl.Version] {
			c.diags.Error(
				"DCL_VERSION_UNSUPPORTED",
				fmt.Sprintf("DCL language %s is not supported by DCL Compiler %s; supported language versions: %s", decl.Version, version.CompilerVersion(), strings.Join(supported, ", ")),
				decl.Span,
				decl.Version,
			)
			continue
		}
		if previous, exists := byFile[decl.Span.File]; exists && previous != decl.Version {
			c.diags.Error("DCL_VERSION_MIXED", fmt.Sprintf("source file declares incompatible DCL language versions %s and %s", previous, decl.Version), decl.Span, decl.Version)
			continue
		}
		byFile[decl.Span.File] = decl.Version
	}

	versions := map[string][]string{}
	for file, languageVersion := range byFile {
		versions[languageVersion] = append(versions[languageVersion], file)
	}
	if len(versions) > 1 {
		declared := make([]string, 0, len(versions))
		for languageVersion := range versions {
			declared = append(declared, languageVersion)
		}
		sort.Strings(declared)
		for _, decl := range c.program.Languages {
			if supportedSet[decl.Version] {
				c.diags.Error("DCL_VERSION_MIXED", fmt.Sprintf("a single compilation must use one DCL language version; found: %s", strings.Join(declared, ", ")), decl.Span, decl.Version)
				break
			}
		}
	}

	c.languageVersion = version.LatestLanguageVersion()
	if len(versions) == 1 {
		for selected := range versions {
			c.languageVersion = selected
		}
	}
}

func (c *compiler) requireFeature(feature languageFeature, span diagnostic.Span, node string) {
	introduced := featureIntroduced[feature]
	if compareVersion(c.languageVersion, introduced) >= 0 {
		return
	}
	c.diags.Error(
		"DCL_VERSION_FEATURE_UNAVAILABLE",
		fmt.Sprintf("%s requires DCL language %s or later; this source declares DCL language %s", feature, introduced, c.languageVersion),
		span,
		node,
	)
}
