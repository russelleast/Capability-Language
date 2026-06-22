package ast

import "capabilitylanguage/internal/diagnostic"

type Program struct {
	Files        []string
	Languages    []LanguageDecl
	Contexts     []ContextDecl
	Dependencies []DependencyDecl
	Shapes       []ShapeDecl
	Actors       []ActorDecl
	Events       []EventDecl
	Effects      []EffectDecl
	Policies     []PolicyDecl
	Capabilities []CapabilityDecl
}

type LanguageDecl struct {
	Name    string
	Version string
	Span    diagnostic.Span
}

type DeclMeta struct {
	ContextName string
	Visibility  string
}

type ContextDecl struct {
	Name   string
	Parent string
	Span   diagnostic.Span
}

type DependencyDecl struct {
	SourceContext string
	TargetContext string
	Span          diagnostic.Span
}

type Field struct {
	Name     string
	Type     string
	Required bool
	Span     diagnostic.Span
}

type Payload struct {
	NamedType string
	Fields    []Field
}

type ShapeDecl struct {
	Name   string
	Fields []Field
	Span   diagnostic.Span
	Meta   DeclMeta
}

type ActorDecl struct {
	Name string
	Kind string
	Span diagnostic.Span
	Meta DeclMeta
}

type EventDecl struct {
	Name    string
	Payload Payload
	Span    diagnostic.Span
	Meta    DeclMeta
}

type EffectDecl struct {
	Name string
	Kind string
	Span diagnostic.Span
	Meta DeclMeta
}

type PolicyDecl struct {
	Name          string
	Kind          string
	Family        string
	Threshold     string
	ThresholdSpan diagnostic.Span
	Concern       string
	Concerns      []ConcernDecl
	Span          diagnostic.Span
	Meta          DeclMeta
}

type ConcernDecl struct {
	Name       string
	Parameters []ConcernParameter
	Span       diagnostic.Span
}

type ConcernParameter struct {
	Name   string
	Values []string
	Span   diagnostic.Span
}

type CapabilityDecl struct {
	Name      string
	Intents   []IntentDecl
	Actors    []ActorRole
	Outcomes  []OutcomeDecl
	Rules     []RuleDecl
	Effects   []EffectUse
	Events    []EventEmissionDecl
	Policies  []PolicyUse
	Observe   []ObservationDecl
	When      []WhenBranch
	Lifecycle *LifecycleDecl
	Span      diagnostic.Span
	Meta      DeclMeta
}

type IntentDecl struct {
	Name      string
	InputType string
	Actor     string
	Span      diagnostic.Span
}

type ActorRole struct {
	Role  string
	Actor string
	Span  diagnostic.Span
}

type OutcomeDecl struct {
	Name    string
	Payload Payload
	Span    diagnostic.Span
}

type RuleDecl struct {
	Name       string
	Expression string
	Span       diagnostic.Span
}

type EffectUse struct {
	Name  string
	After string
	Span  diagnostic.Span
}

type EventEmissionDecl struct {
	Name string
	Span diagnostic.Span
}

type PolicyUse struct {
	Name       string
	TargetKind string
	TargetName string
	Span       diagnostic.Span
}

type ObservationDecl struct {
	TargetKind      string
	TargetName      string
	ObservationType string
	MetricName      string
	Span            diagnostic.Span
}

type WhenBranch struct {
	SourceKind string
	SourceName string
	Decision   string
	Outcome    string
	Otherwise  bool
	Always     bool
	Span       diagnostic.Span
}

type LifecycleDecl struct {
	Name         string
	Supervised   bool
	Identity     string
	Contributors []ContributorDecl
	Begin        string
	Steps        []LifecycleStepDecl
	Ends         []string
	Transitions  []TransitionDecl
	Span         diagnostic.Span
}

type ContributorDecl struct {
	Capability string
	Span       diagnostic.Span
}

type LifecycleStepDecl struct {
	Name             string
	Kind             string
	DecisionProvider string
	Waits            []WaitTriggerDecl
	Deadlines        []DeadlineDecl
	RecoveryActions  []RecoveryDecl
	IsTerminal       bool
	Span             diagnostic.Span
}

type WaitTriggerDecl struct {
	SignalKind       string
	SignalName       string
	SourceCapability string
	Span             diagnostic.Span
}

type DeadlineDecl struct {
	Duration          []string
	ConsequenceKind   string
	ConsequenceSymbol string
	Span              diagnostic.Span
}

type RecoveryDecl struct {
	Target string
	Span   diagnostic.Span
}

type TransitionDecl struct {
	From             string
	To               string
	TriggerKind      string
	TriggerName      string
	SourceCapability string
	Span             diagnostic.Span
}
