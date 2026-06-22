package version

const (
	LanguageName    = "dcl"
	LanguageVersion = "0.10"
	CompilerName    = "dcl"
	CompilerVersion = "0.1.0"
)

func Summary() string {
	return CompilerName + " compiler " + CompilerVersion + " (DCL language " + LanguageVersion + ")"
}
