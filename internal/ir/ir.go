package ir

import "capabilitylanguage/internal/diagnostic"

type ProgramIR struct {
	Modules      []ModuleIR                  `json:"modules"`
	Symbols      []SymbolIR                  `json:"symbols"`
	Capabilities []CapabilityIR              `json:"capabilities"`
	Actors       []ActorIR                   `json:"actors"`
	Effects      []EffectIR                  `json:"effects"`
	Events       []EventIR                   `json:"events"`
	Policies     []PolicyIR                  `json:"policies"`
	Shapes       []ShapeIR                   `json:"shapes"`
	Diagnostics  []diagnostic.Diagnostic     `json:"diagnostics"`
	Analysis     map[string]PortabilityFacts `json:"analysis,omitempty"`
}

type ModuleIR struct {
	ID    string   `json:"id"`
	Files []string `json:"files"`
}

type SymbolIR struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Kind     string `json:"kind"`
	Declared string `json:"declared"`
}

type ShapeIR struct {
	ID     string    `json:"id"`
	Name   string    `json:"name"`
	Fields []FieldIR `json:"fields"`
}

type FieldIR struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Required bool   `json:"required"`
}

type ActorIR struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Classification string `json:"classification"`
}

type CapabilityIR struct {
	ID         string             `json:"id"`
	Name       string             `json:"name"`
	Intents    []IntentIR         `json:"intents"`
	Actors     []ActorRoleIR      `json:"actors,omitempty"`
	Outcomes   []OutcomeIR        `json:"outcomes"`
	Invariants []InvariantIR      `json:"invariants,omitempty"`
	Effects    []EffectUseIR      `json:"effects,omitempty"`
	Events     []EmitIR           `json:"events,omitempty"`
	Policies   []PolicyUseIR      `json:"policies,omitempty"`
	Lifecycle  *LifecycleIR       `json:"lifecycle,omitempty"`
	Relations  []RelationIR       `json:"relations,omitempty"`
	Analysis   CapabilityAnalysis `json:"analysis"`
}

type IntentIR struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Capability  string `json:"capability"`
	InputShape  string `json:"input_shape"`
	Actor       string `json:"actor"`
	Source      string `json:"source"`
}

type ActorRoleIR struct {
	Role  string `json:"role"`
	Actor string `json:"actor"`
}

type PayloadIR struct {
	NamedType string    `json:"named_type,omitempty"`
	Fields    []FieldIR `json:"fields,omitempty"`
}

type OutcomeIR struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Capability     string    `json:"capability"`
	Classification string    `json:"classification,omitempty"`
	Payload         PayloadIR `json:"payload,omitempty"`
}

type InvariantIR struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Capability string `json:"capability"`
	Assertion  string `json:"assertion"`
}

type EffectIR struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Type   string `json:"type"`
	Origin string `json:"origin,omitempty"`
}

type EffectUseIR struct {
	Effect  string `json:"effect"`
	After   string `json:"after,omitempty"`
	Origin  string `json:"origin"`
	Ordering string `json:"ordering,omitempty"`
}

type EventIR struct {
	ID      string    `json:"id"`
	Name    string    `json:"name"`
	Payload PayloadIR `json:"payload"`
	Source  string    `json:"source,omitempty"`
}

type EmitIR struct {
	Outcome string `json:"outcome"`
	Event   string `json:"event"`
	Source  string `json:"source"`
}

type PolicyIR struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Category string `json:"category"`
	Target   string `json:"target,omitempty"`
}

type PolicyUseIR struct {
	Policy     string `json:"policy"`
	TargetKind string `json:"target_kind,omitempty"`
	TargetName string `json:"target_name,omitempty"`
}

type LifecycleIR struct {
	ID          string         `json:"id"`
	Initial     string         `json:"initial_state"`
	States      []string       `json:"states"`
	Terminal    []string       `json:"terminal_states,omitempty"`
	Transitions []TransitionIR `json:"transitions,omitempty"`
}

type TransitionIR struct {
	From        string `json:"from"`
	To          string `json:"to"`
	TriggerKind string `json:"trigger_kind"`
	TriggerName string `json:"trigger_name"`
}

type RelationIR struct {
	Kind      string `json:"kind"`
	From      string `json:"from"`
	To        string `json:"to"`
	Condition string `json:"condition,omitempty"`
}

type CapabilityAnalysis struct {
	ReachableOutcomes []string       `json:"reachable_outcomes,omitempty"`
	OutcomeCauses     []OutcomeCause `json:"outcome_causes,omitempty"`
	Portability       string         `json:"portability"`
}

type OutcomeCause struct {
	Outcome    string `json:"outcome"`
	Source     string `json:"source"`
	Condition  string `json:"condition,omitempty"`
	Precedence int    `json:"precedence"`
}

type PortabilityFacts struct {
	Classification string `json:"classification"`
}
