package ir

import "capabilitylanguage/internal/diagnostic"

type ProgramIR struct {
	Modules           []ModuleIR                  `json:"modules"`
	Contexts          []ContextIR                 `json:"contexts,omitempty"`
	Dependencies      []DependencyIR              `json:"dependencies,omitempty"`
	Symbols           []SymbolIR                  `json:"symbols"`
	Capabilities      []CapabilityIR              `json:"capabilities"`
	Actors            []ActorIR                   `json:"actors"`
	Effects           []EffectIR                  `json:"effects"`
	Events            []EventIR                   `json:"events"`
	Policies          []PolicyIR                  `json:"policies"`
	EffectivePolicies []EffectivePolicyIR         `json:"effective_policies,omitempty"`
	Observations      []ObservationIR             `json:"observations,omitempty"`
	Shapes            []ShapeIR                   `json:"shapes"`
	Diagnostics       []diagnostic.Diagnostic     `json:"diagnostics"`
	Analysis          map[string]PortabilityFacts `json:"analysis,omitempty"`
}

type ModuleIR struct {
	ID    string   `json:"id"`
	Files []string `json:"files"`
}

type SymbolIR struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	FullyQualifiedName string `json:"fully_qualified_name,omitempty"`
	Kind               string `json:"kind"`
	Context            string `json:"context,omitempty"`
	Visibility         string `json:"visibility,omitempty"`
	Declared           string `json:"declared"`
}

type ContextIR struct {
	ID            string   `json:"id"`
	Name          string   `json:"name"`
	Parent        string   `json:"parent,omitempty"`
	Children      []string `json:"children,omitempty"`
	Declarations  []string `json:"declarations,omitempty"`
	PublicSymbols []string `json:"public_symbols,omitempty"`
	Dependencies  []string `json:"dependencies,omitempty"`
}

type DependencyIR struct {
	SourceContext     string   `json:"source_context"`
	TargetContext     string   `json:"target_context"`
	ReferencedSymbols []string `json:"referenced_symbols,omitempty"`
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
	ID         string `json:"id"`
	Name       string `json:"name"`
	Capability string `json:"capability"`
	InputShape string `json:"input_shape"`
	Actor      string `json:"actor"`
	Source     string `json:"source"`
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
	Payload        PayloadIR `json:"payload,omitempty"`
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
	Effect   string `json:"effect"`
	After    string `json:"after,omitempty"`
	Origin   string `json:"origin"`
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
	ID                 string                `json:"id"`
	Name               string                `json:"name"`
	Family             string                `json:"family"`
	Concern            string                `json:"concern,omitempty"`
	Concerns           []ConcernIR           `json:"concerns,omitempty"`
	Objectives         []ObjectiveIR         `json:"objectives,omitempty"`
	AttachmentPoints   []PolicyAttachmentIR  `json:"attachment_points,omitempty"`
	DerivedObligations []DerivedObligationIR `json:"derived_obligations,omitempty"`
	Type               string                `json:"type,omitempty"`
	Category           string                `json:"category,omitempty"`
	Target             string                `json:"target,omitempty"`
}

type EffectivePolicyIR struct {
	ID                   string                      `json:"id"`
	TargetKind           string                      `json:"target_kind"`
	TargetSymbol         string                      `json:"target_symbol"`
	ContainingCapability string                      `json:"containing_capability"`
	AppliedPolicies      []string                    `json:"applied_policies,omitempty"`
	EffectiveConcerns    []EffectiveConcernIR        `json:"effective_concerns,omitempty"`
	CompositionResults   []PolicyCompositionResultIR `json:"composition_results,omitempty"`
	Conflicts            []PolicyConflictIR          `json:"conflicts,omitempty"`
	Obligations          []PolicyObligationIR        `json:"obligations,omitempty"`
	Causations           []PolicyCausationIR         `json:"causations,omitempty"`
	Portability          string                      `json:"portability"`
	SourceLocations      []diagnostic.Span           `json:"source_locations,omitempty"`
}

type EffectiveConcernIR struct {
	Name                string               `json:"name"`
	Family              string               `json:"family"`
	TargetKind          string               `json:"target_kind"`
	TargetSymbol        string               `json:"target_symbol"`
	SourcePolicies      []string             `json:"source_policies,omitempty"`
	EffectiveParameters []ConcernParameterIR `json:"effective_parameters,omitempty"`
	CompositionMode     string               `json:"composition_mode"`
	InheritedFrom       string               `json:"inherited_from,omitempty"`
	NarrowedFrom        string               `json:"narrowed_from,omitempty"`
	Overrides           []string             `json:"overrides,omitempty"`
	Diagnostics         []string             `json:"diagnostics,omitempty"`
}

type PolicyCompositionResultIR struct {
	Concern        string   `json:"concern"`
	TargetKind     string   `json:"target_kind"`
	TargetSymbol   string   `json:"target_symbol"`
	Mode           string   `json:"mode"`
	SourcePolicies []string `json:"source_policies,omitempty"`
	Result         string   `json:"result"`
	Diagnostics    []string `json:"diagnostics,omitempty"`
}

type PolicyConflictIR struct {
	Concern      string   `json:"concern"`
	TargetKind   string   `json:"target_kind"`
	TargetSymbol string   `json:"target_symbol"`
	Policies     []string `json:"policies,omitempty"`
	Reason       string   `json:"reason"`
}

type PolicyObligationIR struct {
	SourcePolicy             string   `json:"source_policy"`
	SourceConcern            string   `json:"source_concern"`
	TargetKind               string   `json:"target_kind"`
	TargetSymbol             string   `json:"target_symbol"`
	CompilerObligations      []string `json:"compiler_obligations,omitempty"`
	RuntimeObligations       []string `json:"runtime_obligations,omitempty"`
	ObservabilityObligations []string `json:"observability_obligations,omitempty"`
	VerificationObligations  []string `json:"verification_obligations,omitempty"`
}

type PolicyCausationIR struct {
	Policy         string          `json:"policy"`
	Concern        string          `json:"concern,omitempty"`
	State          string          `json:"state"`
	Outcome        string          `json:"outcome"`
	TargetKind     string          `json:"target_kind,omitempty"`
	TargetSymbol   string          `json:"target_symbol,omitempty"`
	SourceLocation diagnostic.Span `json:"source_location,omitempty"`
}

type ConcernIR struct {
	Name           string               `json:"name"`
	Family         string               `json:"family"`
	Parameters     []ConcernParameterIR `json:"parameters,omitempty"`
	SourceLocation diagnostic.Span      `json:"source_location,omitempty"`
}

type ConcernParameterIR struct {
	Name   string   `json:"name"`
	Values []string `json:"values,omitempty"`
}

type ObjectiveIR struct {
	Concern string   `json:"concern"`
	Values  []string `json:"values,omitempty"`
}

type PolicyAttachmentIR struct {
	Capability string `json:"capability"`
	TargetKind string `json:"target_kind"`
	TargetName string `json:"target_name,omitempty"`
}

type DerivedObligationIR struct {
	Concern    string `json:"concern"`
	Obligation string `json:"obligation"`
	TargetKind string `json:"target_kind,omitempty"`
	TargetName string `json:"target_name,omitempty"`
}

type PolicyUseIR struct {
	Policy     string `json:"policy"`
	TargetKind string `json:"target_kind,omitempty"`
	TargetName string `json:"target_name,omitempty"`
}

type ObservationIR struct {
	TargetKind      string `json:"target_kind"`
	TargetReference string `json:"target_reference"`
	ObservationType string `json:"observation_type"`
	MetricName      string `json:"metric_name"`
}

type LifecycleIR struct {
	ID                        string            `json:"id"`
	Name                      string            `json:"name,omitempty"`
	OwnerCapability           string            `json:"owner_capability,omitempty"`
	IdentityBinding           string            `json:"identity_binding,omitempty"`
	ParticipatingCapabilities []string          `json:"participating_capabilities,omitempty"`
	Contributors              []ContributorIR   `json:"contributors,omitempty"`
	Steps                     []LifecycleStepIR `json:"steps,omitempty"`
	Policies                  []PolicyUseIR     `json:"policies,omitempty"`
	Initial                   string            `json:"initial_state"`
	States                    []string          `json:"states"`
	Terminal                  []string          `json:"terminal_states,omitempty"`
	Transitions               []TransitionIR    `json:"transitions,omitempty"`
}

type LifecycleStepIR struct {
	Name            string          `json:"name"`
	Kind            string          `json:"kind,omitempty"`
	WaitingTriggers []WaitTriggerIR `json:"waiting_triggers,omitempty"`
	Deadlines       []DeadlineIR    `json:"deadlines,omitempty"`
	RecoveryActions []RecoveryIR    `json:"recovery_actions,omitempty"`
	IsTerminal      bool            `json:"is_terminal,omitempty"`
}

type WaitTriggerIR struct {
	SignalKind       string `json:"signal_kind"`
	SignalName       string `json:"signal_name"`
	SourceCapability string `json:"source_capability,omitempty"`
}

type DeadlineIR struct {
	Step              string `json:"step"`
	Duration          string `json:"duration"`
	ConsequenceKind   string `json:"consequence_kind"`
	ConsequenceSymbol string `json:"consequence_symbol"`
}

type RecoveryIR struct {
	DeclaringStep  string   `json:"declaring_step"`
	Target         string   `json:"target"`
	TargetKind     string   `json:"target_kind"`
	ResultOutcomes []string `json:"result_outcomes,omitempty"`
}

type ContributorIR struct {
	Capability         string   `json:"capability"`
	UsedByTransitions  []string `json:"used_by_transitions,omitempty"`
	UsedByWaitingSteps []string `json:"used_by_waiting_steps,omitempty"`
	UsedByRecovery     []string `json:"used_by_recovery,omitempty"`
}

type TransitionIR struct {
	From               string        `json:"from"`
	To                 string        `json:"to"`
	TriggerKind        string        `json:"trigger_kind"`
	TriggerName        string        `json:"trigger_name"`
	SourceStep         string        `json:"source_step,omitempty"`
	TargetStep         string        `json:"target_step,omitempty"`
	SourceKind         string        `json:"source_kind,omitempty"`
	SourceCapability   string        `json:"source_capability,omitempty"`
	SourceSymbol       string        `json:"source_symbol,omitempty"`
	CorrelationBinding string        `json:"correlation_binding,omitempty"`
	Policies           []PolicyUseIR `json:"policies,omitempty"`
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
