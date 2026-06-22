package summary

import (
	"strings"

	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/ir"
)

type SemanticSummary struct {
	Contexts     []ContextSummary    `json:"contexts,omitempty"`
	Capabilities []CapabilitySummary `json:"capabilities"`
	Effects      []NamedSummary      `json:"effects,omitempty"`
	Policies     []NamedSummary      `json:"policies,omitempty"`
	Lifecycles   []LifecycleSummary  `json:"lifecycles,omitempty"`
}

type ContextSummary struct {
	Name         string          `json:"name"`
	Parent       string          `json:"parent,omitempty"`
	Children     []string        `json:"children,omitempty"`
	Dependencies []string        `json:"dependencies,omitempty"`
	Location     diagnostic.Span `json:"location,omitempty"`
}

type NamedSummary struct {
	Name     string          `json:"name"`
	Kind     string          `json:"kind,omitempty"`
	Type     string          `json:"type,omitempty"`
	Location diagnostic.Span `json:"location,omitempty"`
}

type CapabilitySummary struct {
	ID        string             `json:"id,omitempty"`
	Name      string             `json:"name"`
	Context   string             `json:"context,omitempty"`
	Location  diagnostic.Span    `json:"location,omitempty"`
	Intents   []IntentSummary    `json:"intents,omitempty"`
	Outcomes  []string           `json:"outcomes,omitempty"`
	Effects   []EffectUseSummary `json:"effects,omitempty"`
	Policies  []PolicyUseSummary `json:"policies,omitempty"`
	Lifecycle *LifecycleSummary  `json:"lifecycle,omitempty"`
}

type IntentSummary struct {
	Name       string `json:"name,omitempty"`
	InputShape string `json:"inputShape,omitempty"`
	Actor      string `json:"actor,omitempty"`
}

type EffectUseSummary struct {
	Effect string `json:"effect"`
	After  string `json:"after,omitempty"`
}

type PolicyUseSummary struct {
	Policy     string `json:"policy"`
	TargetKind string `json:"targetKind,omitempty"`
	TargetName string `json:"targetName,omitempty"`
}

type LifecycleSummary struct {
	Name                      string                       `json:"name,omitempty"`
	OwnerCapability           string                       `json:"ownerCapability,omitempty"`
	Initial                   string                       `json:"initial,omitempty"`
	Terminal                  []string                     `json:"terminal,omitempty"`
	Steps                     []LifecycleStepSummary       `json:"steps,omitempty"`
	Transitions               []LifecycleTransitionSummary `json:"transitions,omitempty"`
	ParticipatingCapabilities []string                     `json:"participatingCapabilities,omitempty"`
}

type LifecycleStepSummary struct {
	Name       string `json:"name"`
	Kind       string `json:"kind,omitempty"`
	IsTerminal bool   `json:"isTerminal,omitempty"`
}

type LifecycleTransitionSummary struct {
	From             string `json:"from"`
	To               string `json:"to"`
	TriggerKind      string `json:"triggerKind,omitempty"`
	TriggerName      string `json:"triggerName,omitempty"`
	SourceCapability string `json:"sourceCapability,omitempty"`
}

func FromIR(program ir.ProgramIR) SemanticSummary {
	symbols := symbolLocations(program.Symbols)
	capabilityContexts := symbolContexts(program.Symbols, "capability")
	effectContexts := symbolContexts(program.Symbols, "effect")
	policyContexts := symbolContexts(program.Symbols, "policy")

	capabilities := make([]CapabilitySummary, 0, len(program.Capabilities))
	lifecycles := make([]LifecycleSummary, 0)
	for _, capability := range program.Capabilities {
		context := capabilityContexts[capability.Name]
		if context == "" {
			context = contextFromID(capability.ID, capability.Name)
		}
		item := CapabilitySummary{
			ID:       capability.ID,
			Name:     capability.Name,
			Context:  context,
			Location: symbols.location("capability", capability.Name, context),
			Intents:  summarizeIntents(capability.Intents),
			Outcomes: summarizeOutcomes(capability.Outcomes),
			Effects:  summarizeEffectUses(capability.Effects),
			Policies: summarizePolicyUses(capability.Policies),
		}
		if capability.Lifecycle != nil {
			lifecycle := summarizeLifecycle(*capability.Lifecycle)
			item.Lifecycle = &lifecycle
			lifecycles = append(lifecycles, lifecycle)
		}
		capabilities = append(capabilities, item)
	}

	return SemanticSummary{
		Contexts:     summarizeContexts(program.Contexts, symbols),
		Capabilities: capabilities,
		Effects:      summarizeEffects(program.Effects, symbols, effectContexts),
		Policies:     summarizePolicies(program.Policies, symbols, policyContexts),
		Lifecycles:   lifecycles,
	}
}

type locationIndex map[string]diagnostic.Span

func symbolLocations(symbols []ir.SymbolIR) locationIndex {
	index := locationIndex{}
	for _, symbol := range symbols {
		index[key(symbol.Kind, symbol.Name, symbol.Context)] = parseDeclared(symbol.Declared)
	}
	return index
}

func symbolContexts(symbols []ir.SymbolIR, kind string) map[string]string {
	contexts := map[string]string{}
	for _, symbol := range symbols {
		if symbol.Kind == kind && contexts[symbol.Name] == "" {
			contexts[symbol.Name] = symbol.Context
		}
	}
	return contexts
}

func (index locationIndex) location(kind, name, context string) diagnostic.Span {
	if span := index[key(kind, name, context)]; span.File != "" || span.Line > 0 || span.Column > 0 {
		return span
	}
	return index[key(kind, name, "")]
}

func key(kind, name, context string) string {
	return kind + "\x00" + context + "\x00" + name
}

func summarizeContexts(contexts []ir.ContextIR, symbols locationIndex) []ContextSummary {
	out := make([]ContextSummary, 0, len(contexts))
	for _, context := range contexts {
		if context.Name == "default" && len(contexts) > 1 && len(context.Declarations) == 0 {
			continue
		}
		out = append(out, ContextSummary{
			Name:         context.Name,
			Parent:       context.Parent,
			Children:     context.Children,
			Dependencies: context.Dependencies,
			Location:     symbols.location("context", context.Name, context.Name),
		})
	}
	return out
}

func summarizeIntents(intents []ir.IntentIR) []IntentSummary {
	out := make([]IntentSummary, 0, len(intents))
	for _, intent := range intents {
		out = append(out, IntentSummary{Name: intent.Name, InputShape: intent.InputShape, Actor: intent.Actor})
	}
	return out
}

func summarizeOutcomes(outcomes []ir.OutcomeIR) []string {
	out := make([]string, 0, len(outcomes))
	for _, outcome := range outcomes {
		out = append(out, outcome.Name)
	}
	return out
}

func summarizeEffectUses(effects []ir.EffectUseIR) []EffectUseSummary {
	out := make([]EffectUseSummary, 0, len(effects))
	for _, effect := range effects {
		out = append(out, EffectUseSummary{Effect: effect.Effect, After: effect.After})
	}
	return out
}

func summarizePolicyUses(policies []ir.PolicyUseIR) []PolicyUseSummary {
	out := make([]PolicyUseSummary, 0, len(policies))
	for _, policy := range policies {
		out = append(out, PolicyUseSummary{Policy: policy.Policy, TargetKind: policy.TargetKind, TargetName: policy.TargetName})
	}
	return out
}

func summarizeEffects(effects []ir.EffectIR, symbols locationIndex, contexts map[string]string) []NamedSummary {
	out := make([]NamedSummary, 0, len(effects))
	for _, effect := range effects {
		out = append(out, NamedSummary{Name: effect.Name, Type: effect.Type, Location: symbols.location("effect", effect.Name, contexts[effect.Name])})
	}
	return out
}

func summarizePolicies(policies []ir.PolicyIR, symbols locationIndex, contexts map[string]string) []NamedSummary {
	out := make([]NamedSummary, 0, len(policies))
	for _, policy := range policies {
		out = append(out, NamedSummary{Name: policy.Name, Kind: policy.Kind, Type: policy.Family, Location: symbols.location("policy", policy.Name, contexts[policy.Name])})
	}
	return out
}

func summarizeLifecycle(lifecycle ir.LifecycleIR) LifecycleSummary {
	return LifecycleSummary{
		Name:                      lifecycle.Name,
		OwnerCapability:           lifecycle.OwnerCapability,
		Initial:                   lifecycle.Initial,
		Terminal:                  lifecycle.Terminal,
		Steps:                     summarizeLifecycleSteps(lifecycle.Steps),
		Transitions:               summarizeTransitions(lifecycle.Transitions),
		ParticipatingCapabilities: lifecycle.ParticipatingCapabilities,
	}
}

func summarizeLifecycleSteps(steps []ir.LifecycleStepIR) []LifecycleStepSummary {
	out := make([]LifecycleStepSummary, 0, len(steps))
	for _, step := range steps {
		out = append(out, LifecycleStepSummary{Name: step.Name, Kind: step.Kind, IsTerminal: step.IsTerminal})
	}
	return out
}

func summarizeTransitions(transitions []ir.TransitionIR) []LifecycleTransitionSummary {
	out := make([]LifecycleTransitionSummary, 0, len(transitions))
	for _, transition := range transitions {
		out = append(out, LifecycleTransitionSummary{
			From:             transition.From,
			To:               transition.To,
			TriggerKind:      transition.TriggerKind,
			TriggerName:      transition.TriggerName,
			SourceCapability: transition.SourceCapability,
		})
	}
	return out
}

func contextFromID(id, name string) string {
	withoutKind := strings.TrimPrefix(id, "capability:")
	if withoutKind == name || !strings.HasSuffix(withoutKind, "."+name) {
		return ""
	}
	return strings.TrimSuffix(withoutKind, "."+name)
}

func parseDeclared(value string) diagnostic.Span {
	if value == "" {
		return diagnostic.Span{}
	}
	columnSeparator := strings.LastIndex(value, ":")
	if columnSeparator < 0 {
		return diagnostic.Span{File: value}
	}
	lineSeparator := strings.LastIndex(value[:columnSeparator], ":")
	if lineSeparator < 0 {
		return diagnostic.Span{File: value}
	}
	return diagnostic.Span{
		File:   value[:lineSeparator],
		Line:   parsePositiveInt(value[lineSeparator+1 : columnSeparator]),
		Column: parsePositiveInt(value[columnSeparator+1:]),
	}
}

func parsePositiveInt(value string) int {
	out := 0
	for _, ch := range value {
		if ch < '0' || ch > '9' {
			return 0
		}
		out = out*10 + int(ch-'0')
	}
	return out
}
