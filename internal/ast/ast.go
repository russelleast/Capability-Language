package ast

import "capabilitylanguage/internal/diagnostic"

type Program struct {
	Files        []string
	Shapes       []ShapeDecl
	Actors       []ActorDecl
	Events       []EventDecl
	Effects      []EffectDecl
	Policies     []PolicyDecl
	Capabilities []CapabilityDecl
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
}

type ActorDecl struct {
	Name string
	Kind string
	Span diagnostic.Span
}

type EventDecl struct {
	Name    string
	Payload Payload
	Span    diagnostic.Span
}

type EffectDecl struct {
	Name string
	Kind string
	Span diagnostic.Span
}

type PolicyDecl struct {
	Name     string
	Family   string
	Concern  string
	Concerns []ConcernDecl
	Span     diagnostic.Span
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
	Policies  []PolicyUse
	Observe   []ObservationDecl
	When      []WhenBranch
	Lifecycle *LifecycleDecl
	Span      diagnostic.Span
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
	Span       diagnostic.Span
}

type LifecycleDecl struct {
	Begin       string
	Steps       []string
	Ends        []string
	Transitions []TransitionDecl
	Span        diagnostic.Span
}

type TransitionDecl struct {
	From        string
	To          string
	TriggerKind string
	TriggerName string
	Span        diagnostic.Span
}
