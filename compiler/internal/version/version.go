package version

const (
	LanguageName    = "dcl"
	LanguageVersion = "1.0"
	CompilerName    = "dcl"
	CompilerVersion = "1.0"
)

func Summary() string {
	return CompilerName + " compiler " + CompilerVersion + " (DCL language " + LanguageVersion + ")"
}
