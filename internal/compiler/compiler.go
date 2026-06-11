package compiler

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"capabilitylanguage/internal/ast"
	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/ir"
	"capabilitylanguage/internal/lexer"
	"capabilitylanguage/internal/parser"
)

type Result struct {
	IR          ir.ProgramIR
	Diagnostics []diagnostic.Diagnostic
}

func CompileFiles(paths []string) Result {
	var bag diagnostic.Bag
	var program ast.Program

	files := append([]string(nil), paths...)
	sort.Strings(files)
	program.Files = files

	for _, path := range files {
		src, err := os.ReadFile(path)
		if err != nil {
			bag.Error("DCL_IO_READ_FAILED", err.Error(), diagnostic.Span{File: path}, "")
			continue
		}
		tokens, lexDiags := lexer.Lex(path, string(src))
		for _, d := range lexDiags {
			bag.Add(d.Severity, d.Code, d.Message, d.Span, d.Node)
		}
		parsed, parseDiags := parser.Parse(tokens)
		for _, d := range parseDiags {
			bag.Add(d.Severity, d.Code, d.Message, d.Span, d.Node)
		}
		mergeProgram(&program, parsed)
	}

	c := newCompiler(program, &bag)
	out := c.buildIR()
	out.Diagnostics = bag.Items()
	return Result{IR: out, Diagnostics: out.Diagnostics}
}

func HasErrors(diags []diagnostic.Diagnostic) bool {
	for _, d := range diags {
		if d.Severity == diagnostic.Error {
			return true
		}
	}
	return false
}

func MarshalIR(program ir.ProgramIR) ([]byte, error) {
	return json.MarshalIndent(program, "", "  ")
}

type compiler struct {
	program ast.Program
	diags   *diagnostic.Bag
	symbols map[string]map[string]diagnostic.Span
}

func newCompiler(program ast.Program, diags *diagnostic.Bag) *compiler {
	c := &compiler{program: program, diags: diags, symbols: map[string]map[string]diagnostic.Span{}}
	c.indexSymbols()
	return c
}

func (c *compiler) buildIR() ir.ProgramIR {
	out := ir.ProgramIR{
		Modules:  []ir.ModuleIR{{ID: "module:main", Files: c.program.Files}},
		Analysis: map[string]ir.PortabilityFacts{"default": {Classification: "portable"}},
	}

	for _, shape := range c.program.Shapes {
		out.Shapes = append(out.Shapes, ir.ShapeIR{ID: id("shape", shape.Name), Name: shape.Name, Fields: fieldsIR(shape.Fields)})
		out.Symbols = append(out.Symbols, symbol("shape", shape.Name, shape.Span))
		c.validateFields(shape.Fields)
	}
	for _, actor := range c.program.Actors {
		if actor.Kind == "" {
			c.diags.Error("DCL_SEM_ACTOR_KIND_REQUIRED", "actor must declare kind", actor.Span, actor.Name)
		}
		out.Actors = append(out.Actors, ir.ActorIR{ID: id("actor", actor.Name), Name: actor.Name, Classification: actor.Kind})
		out.Symbols = append(out.Symbols, symbol("actor", actor.Name, actor.Span))
	}
	for _, effect := range c.program.Effects {
		if effect.Kind == "" {
			c.diags.Error("DCL_SEM_EFFECT_KIND_REQUIRED", "effect must declare kind", effect.Span, effect.Name)
		}
		out.Effects = append(out.Effects, ir.EffectIR{ID: id("effect", effect.Name), Name: effect.Name, Type: effect.Kind})
		out.Symbols = append(out.Symbols, symbol("effect", effect.Name, effect.Span))
	}
	for _, event := range c.program.Events {
		c.validatePayload(event.Payload)
		out.Events = append(out.Events, ir.EventIR{ID: id("event", event.Name), Name: event.Name, Payload: payloadIR(event.Payload)})
		out.Symbols = append(out.Symbols, symbol("event", event.Name, event.Span))
	}
	for _, policy := range c.program.Policies {
		if !validPolicyKind(policy.Kind) {
			c.diags.Error("DCL_SEM_POLICY_KIND_UNSUPPORTED", "unsupported policy kind "+policy.Kind, policy.Span, policy.Name)
		}
		out.Policies = append(out.Policies, ir.PolicyIR{ID: id("policy", policy.Name), Name: policy.Name, Type: policy.Kind, Category: policy.Kind})
		out.Symbols = append(out.Symbols, symbol("policy", policy.Name, policy.Span))
	}
	for _, capability := range c.program.Capabilities {
		out.Capabilities = append(out.Capabilities, c.capabilityIR(capability))
		out.Symbols = append(out.Symbols, symbol("capability", capability.Name, capability.Span))
	}

	sortProgramIR(&out)
	return out
}

func (c *compiler) capabilityIR(cap ast.CapabilityDecl) ir.CapabilityIR {
	capIR := ir.CapabilityIR{
		ID:       id("capability", cap.Name),
		Name:     cap.Name,
		Analysis: ir.CapabilityAnalysis{Portability: "portable"},
	}

	if len(cap.Intents) == 0 {
		c.diags.Error("DCL_SEM_CAPABILITY_INTENT_REQUIRED", "capability must declare at least one intent", cap.Span, cap.Name)
	}
	if len(cap.Outcomes) == 0 {
		c.diags.Error("DCL_SEM_CAPABILITY_OUTCOME_REQUIRED", "capability must declare at least one outcome", cap.Span, cap.Name)
	}

	localOutcomes := map[string]ast.OutcomeDecl{}
	localRules := map[string]ast.RuleDecl{}
	localEffects := map[string]ast.EffectUse{}
	localActorRoles := map[string]ast.ActorRole{}
	localPolicies := map[string]ast.PolicyUse{}

	for _, intent := range cap.Intents {
		c.requireGlobal("actor", intent.Actor, intent.Span)
		c.requireGlobal("shape", intent.InputType, intent.Span)
		capIR.Intents = append(capIR.Intents, ir.IntentIR{
			ID: id("intent", cap.Name+"."+intent.Name), Name: intent.Name, Capability: cap.Name,
			InputShape: intent.InputType, Actor: intent.Actor, Source: "declared",
		})
	}
	for _, role := range cap.Actors {
		c.requireGlobal("actor", role.Actor, role.Span)
		localActorRoles[role.Role] = role
		capIR.Actors = append(capIR.Actors, ir.ActorRoleIR{Role: role.Role, Actor: role.Actor})
	}
	for _, outcome := range cap.Outcomes {
		localOutcomes[outcome.Name] = outcome
		c.validatePayload(outcome.Payload)
		capIR.Outcomes = append(capIR.Outcomes, ir.OutcomeIR{
			ID: id("outcome", cap.Name+"."+outcome.Name), Name: outcome.Name, Capability: cap.Name, Payload: payloadIR(outcome.Payload),
		})
	}
	for _, rule := range cap.Rules {
		localRules[rule.Name] = rule
		capIR.Invariants = append(capIR.Invariants, ir.InvariantIR{ID: id("rule", cap.Name+"."+rule.Name), Name: rule.Name, Capability: cap.Name, Assertion: rule.Expression})
		c.validateRuleExpression(rule, localActorRoles)
	}
	for _, effect := range cap.Effects {
		localEffects[effect.Name] = effect
	}
	for _, effect := range cap.Effects {
		c.requireGlobal("effect", effect.Name, effect.Span)
		if effect.After != "" {
			if _, ok := localEffects[effect.After]; !ok {
				c.diags.Error("DCL_SEM_EFFECT_ORDER_UNKNOWN", "effect ordering references an effect not used in this capability", effect.Span, effect.After)
			}
		}
		capIR.Effects = append(capIR.Effects, ir.EffectUseIR{Effect: effect.Name, After: effect.After, Origin: cap.Name, Ordering: ordering(effect)})
	}
	for _, policy := range cap.Policies {
		localPolicies[policy.Name] = policy
		c.requireGlobal("policy", policy.Name, policy.Span)
		if policy.TargetKind != "" {
			c.validatePolicyTarget(policy, localEffects)
		}
		capIR.Policies = append(capIR.Policies, ir.PolicyUseIR{Policy: policy.Name, TargetKind: policy.TargetKind, TargetName: policy.TargetName})
	}

	c.validateWhen(cap, localOutcomes, localRules, localEffects, localPolicies, &capIR)
	if cap.Lifecycle != nil {
		capIR.Lifecycle = c.lifecycleIR(cap, localOutcomes)
	}

	sortCapabilityIR(&capIR)
	return capIR
}

func (c *compiler) validateWhen(cap ast.CapabilityDecl, outcomes map[string]ast.OutcomeDecl, rules map[string]ast.RuleDecl, effects map[string]ast.EffectUse, policies map[string]ast.PolicyUse, capIR *ir.CapabilityIR) {
	caused := map[string]bool{}
	otherwiseSeen := false
	for i, branch := range cap.When {
		sourceKind := branch.SourceKind
		if branch.Otherwise {
			if otherwiseSeen {
				c.diags.Error("DCL_SEM_OTHERWISE_DUPLICATE", "otherwise branch appears more than once", branch.Span, cap.Name)
			}
			if i != len(cap.When)-1 {
				c.diags.Error("DCL_SEM_OTHERWISE_NOT_LAST", "otherwise branch must appear last", branch.Span, cap.Name)
			}
			otherwiseSeen = true
		} else {
			switch branch.Decision {
			case "violated":
				sourceKind = "rule"
				if _, ok := rules[branch.SourceName]; !ok {
					c.diags.Error("DCL_SEM_UNKNOWN_RULE", "when branch references unknown rule", branch.Span, branch.SourceName)
				}
			case "unresolved":
				sourceKind = "effect"
				if _, ok := effects[branch.SourceName]; !ok {
					c.diags.Error("DCL_SEM_UNKNOWN_EFFECT_USE", "when branch references effect not used by capability", branch.Span, branch.SourceName)
				}
			case "denied":
				sourceKind = "policy"
				if _, ok := policies[branch.SourceName]; !ok && !c.hasGlobal("policy", branch.SourceName) {
					c.diags.Error("DCL_SEM_UNKNOWN_POLICY", "when branch references unknown policy", branch.Span, branch.SourceName)
				}
			default:
				c.diags.Error("DCL_SEM_CAUSATION_DECISION_UNKNOWN", "unknown v0.2 causation decision", branch.Span, branch.Decision)
			}
		}
		if _, ok := outcomes[branch.Outcome]; !ok {
			c.diags.Error("DCL_SEM_UNKNOWN_OUTCOME", "when branch references unknown outcome", branch.Span, branch.Outcome)
		}
		caused[branch.Outcome] = true
		source := sourceKind + ":" + branch.SourceName
		condition := branch.Decision
		if branch.Otherwise {
			source = "capability:" + cap.Name
			condition = "otherwise"
		}
		capIR.Analysis.OutcomeCauses = append(capIR.Analysis.OutcomeCauses, ir.OutcomeCause{Outcome: branch.Outcome, Source: source, Condition: condition, Precedence: i})
		capIR.Analysis.ReachableOutcomes = append(capIR.Analysis.ReachableOutcomes, branch.Outcome)
		capIR.Relations = append(capIR.Relations, ir.RelationIR{Kind: "causes", From: source, To: branch.Outcome, Condition: condition})
	}
	for outcome := range outcomes {
		if !caused[outcome] {
			c.diags.Error("DCL_SEM_OUTCOME_CAUSE_REQUIRED", "outcome has no explicit causation", outcomes[outcome].Span, outcome)
		}
	}
}

func (c *compiler) lifecycleIR(cap ast.CapabilityDecl, outcomes map[string]ast.OutcomeDecl) *ir.LifecycleIR {
	lc := cap.Lifecycle
	states := setFrom(lc.Steps)
	if lc.Begin != "" {
		states[lc.Begin] = true
	}
	for _, end := range lc.Ends {
		states[end] = true
	}
	if lc.Begin == "" {
		c.diags.Error("DCL_SEM_LIFECYCLE_BEGIN_REQUIRED", "lifecycle must declare an initial state", lc.Span, cap.Name)
	}
	out := &ir.LifecycleIR{ID: id("lifecycle", cap.Name), Initial: lc.Begin, States: sortedKeys(states), Terminal: sortedStrings(lc.Ends)}
	graph := map[string][]string{}
	for _, tr := range lc.Transitions {
		if !states[tr.From] {
			c.diags.Error("DCL_SEM_LIFECYCLE_UNKNOWN_STATE", "transition references unknown source state", tr.Span, tr.From)
		}
		if !states[tr.To] {
			c.diags.Error("DCL_SEM_LIFECYCLE_UNKNOWN_STATE", "transition references unknown target state", tr.Span, tr.To)
		}
		switch tr.TriggerKind {
		case "outcome":
			if _, ok := outcomes[tr.TriggerName]; !ok {
				c.diags.Error("DCL_SEM_LIFECYCLE_UNKNOWN_TRIGGER", "lifecycle transition references unknown outcome", tr.Span, tr.TriggerName)
			}
		case "event":
			c.requireGlobal("event", tr.TriggerName, tr.Span)
		default:
			c.diags.Error("DCL_SEM_LIFECYCLE_TRIGGER_KIND", "lifecycle trigger must be event or outcome", tr.Span, tr.TriggerKind)
		}
		graph[tr.From] = append(graph[tr.From], tr.To)
		out.Transitions = append(out.Transitions, ir.TransitionIR{From: tr.From, To: tr.To, TriggerKind: tr.TriggerKind, TriggerName: tr.TriggerName})
	}
	reachable := reachableStates(lc.Begin, graph)
	for state := range states {
		if !reachable[state] {
			c.diags.Warning("DCL_SEM_LIFECYCLE_STATE_UNREACHABLE", "lifecycle state is not reachable from the initial state by declared transitions", lc.Span, state)
		}
		if !contains(lc.Ends, state) && len(graph[state]) == 0 {
			c.diags.Warning("DCL_SEM_LIFECYCLE_DEAD_END", "non-terminal lifecycle state has no outgoing transition", lc.Span, state)
		}
	}
	sort.Slice(out.Transitions, func(i, j int) bool {
		a, b := out.Transitions[i], out.Transitions[j]
		return a.From+a.To+a.TriggerKind+a.TriggerName < b.From+b.To+b.TriggerKind+b.TriggerName
	})
	return out
}

func (c *compiler) validatePolicyTarget(policy ast.PolicyUse, effects map[string]ast.EffectUse) {
	switch policy.TargetKind {
	case "effect":
		if _, ok := effects[policy.TargetName]; !ok {
			c.diags.Error("DCL_SEM_POLICY_TARGET_UNKNOWN", "policy target effect is not used by this capability", policy.Span, policy.TargetName)
		}
	default:
		c.diags.Error("DCL_SEM_POLICY_TARGET_UNSUPPORTED", "unsupported policy target kind", policy.Span, policy.TargetKind)
	}
}

func (c *compiler) validateRuleExpression(rule ast.RuleDecl, actors map[string]ast.ActorRole) {
	for _, token := range strings.Fields(rule.Expression) {
		if strings.HasPrefix(token, "actors.") {
			role := strings.TrimPrefix(token, "actors.")
			if _, ok := actors[role]; !ok {
				c.diags.Error("DCL_SEM_UNKNOWN_ACTOR_ROLE", "rule references unknown actor role", rule.Span, role)
			}
		}
	}
}

func (c *compiler) validateFields(fields []ast.Field) {
	for _, field := range fields {
		c.validateType(field.Type, field.Span)
	}
}

func (c *compiler) validatePayload(payload ast.Payload) {
	if payload.NamedType != "" {
		c.validateType(payload.NamedType, diagnostic.Span{})
	}
	c.validateFields(payload.Fields)
}

func (c *compiler) validateType(name string, span diagnostic.Span) {
	if name == "" || isBuiltinType(name) || strings.HasPrefix(name, "List<") {
		return
	}
	if !c.hasGlobal("shape", name) {
		return
	}
}

func (c *compiler) indexSymbols() {
	add := func(kind, name string, span diagnostic.Span) {
		if c.symbols[kind] == nil {
			c.symbols[kind] = map[string]diagnostic.Span{}
		}
		if old, exists := c.symbols[kind][name]; exists {
			c.diags.Error("DCL_SEM_DUPLICATE_SYMBOL", fmt.Sprintf("duplicate %s %s; first declared at %s:%d:%d", kind, name, old.File, old.Line, old.Column), span, name)
			return
		}
		c.symbols[kind][name] = span
	}
	for _, item := range c.program.Shapes {
		add("shape", item.Name, item.Span)
	}
	for _, item := range c.program.Actors {
		add("actor", item.Name, item.Span)
	}
	for _, item := range c.program.Events {
		add("event", item.Name, item.Span)
	}
	for _, item := range c.program.Effects {
		add("effect", item.Name, item.Span)
	}
	for _, item := range c.program.Policies {
		add("policy", item.Name, item.Span)
	}
	for _, item := range c.program.Capabilities {
		add("capability", item.Name, item.Span)
	}
}

func (c *compiler) hasGlobal(kind, name string) bool {
	_, ok := c.symbols[kind][name]
	return ok
}

func (c *compiler) requireGlobal(kind, name string, span diagnostic.Span) {
	if name == "" {
		return
	}
	if !c.hasGlobal(kind, name) {
		c.diags.Error("DCL_SEM_UNKNOWN_"+strings.ToUpper(kind), "unknown "+kind, span, name)
	}
}

func mergeProgram(dst *ast.Program, src *ast.Program) {
	if src == nil {
		return
	}
	dst.Shapes = append(dst.Shapes, src.Shapes...)
	dst.Actors = append(dst.Actors, src.Actors...)
	dst.Events = append(dst.Events, src.Events...)
	dst.Effects = append(dst.Effects, src.Effects...)
	dst.Policies = append(dst.Policies, src.Policies...)
	dst.Capabilities = append(dst.Capabilities, src.Capabilities...)
}

func fieldsIR(fields []ast.Field) []ir.FieldIR {
	out := make([]ir.FieldIR, 0, len(fields))
	for _, field := range fields {
		out = append(out, ir.FieldIR{Name: field.Name, Type: field.Type, Required: field.Required})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func payloadIR(payload ast.Payload) ir.PayloadIR {
	return ir.PayloadIR{NamedType: payload.NamedType, Fields: fieldsIR(payload.Fields)}
}

func symbol(kind, name string, span diagnostic.Span) ir.SymbolIR {
	return ir.SymbolIR{ID: id(kind, name), Name: name, Kind: kind, Declared: fmt.Sprintf("%s:%d:%d", filepath.ToSlash(span.File), span.Line, span.Column)}
}

func id(kind, name string) string {
	return kind + ":" + name
}

func ordering(effect ast.EffectUse) string {
	if effect.After == "" {
		return ""
	}
	return "after"
}

func isBuiltinType(name string) bool {
	switch name {
	case "Text", "Boolean", "Number", "Date", "DateTime":
		return true
	}
	return false
}

func validPolicyKind(kind string) bool {
	switch kind {
	case "authorization", "timeout", "retry", "idempotency", "consistency", "visibility", "audit", "retention", "security":
		return true
	default:
		return false
	}
}

func setFrom(items []string) map[string]bool {
	out := map[string]bool{}
	for _, item := range items {
		out[item] = true
	}
	return out
}

func sortedKeys(items map[string]bool) []string {
	out := make([]string, 0, len(items))
	for item := range items {
		out = append(out, item)
	}
	sort.Strings(out)
	return out
}

func sortedStrings(items []string) []string {
	out := append([]string(nil), items...)
	sort.Strings(out)
	return out
}

func reachableStates(initial string, graph map[string][]string) map[string]bool {
	out := map[string]bool{}
	if initial == "" {
		return out
	}
	queue := []string{initial}
	for len(queue) > 0 {
		state := queue[0]
		queue = queue[1:]
		if out[state] {
			continue
		}
		out[state] = true
		queue = append(queue, graph[state]...)
	}
	return out
}

func contains(items []string, want string) bool {
	for _, item := range items {
		if item == want {
			return true
		}
	}
	return false
}

func sortProgramIR(out *ir.ProgramIR) {
	sort.Slice(out.Symbols, func(i, j int) bool { return out.Symbols[i].ID < out.Symbols[j].ID })
	sort.Slice(out.Shapes, func(i, j int) bool { return out.Shapes[i].Name < out.Shapes[j].Name })
	sort.Slice(out.Actors, func(i, j int) bool { return out.Actors[i].Name < out.Actors[j].Name })
	sort.Slice(out.Effects, func(i, j int) bool { return out.Effects[i].Name < out.Effects[j].Name })
	sort.Slice(out.Events, func(i, j int) bool { return out.Events[i].Name < out.Events[j].Name })
	sort.Slice(out.Policies, func(i, j int) bool { return out.Policies[i].Name < out.Policies[j].Name })
	sort.Slice(out.Capabilities, func(i, j int) bool { return out.Capabilities[i].Name < out.Capabilities[j].Name })
}

func sortCapabilityIR(out *ir.CapabilityIR) {
	sort.Slice(out.Intents, func(i, j int) bool { return out.Intents[i].ID < out.Intents[j].ID })
	sort.Slice(out.Actors, func(i, j int) bool { return out.Actors[i].Role < out.Actors[j].Role })
	sort.Slice(out.Outcomes, func(i, j int) bool { return out.Outcomes[i].Name < out.Outcomes[j].Name })
	sort.Slice(out.Invariants, func(i, j int) bool { return out.Invariants[i].Name < out.Invariants[j].Name })
	sort.Slice(out.Effects, func(i, j int) bool { return out.Effects[i].Effect < out.Effects[j].Effect })
	sort.Slice(out.Events, func(i, j int) bool {
		return out.Events[i].Outcome+out.Events[i].Event < out.Events[j].Outcome+out.Events[j].Event
	})
	sort.Slice(out.Policies, func(i, j int) bool { return out.Policies[i].Policy < out.Policies[j].Policy })
	sort.Slice(out.Relations, func(i, j int) bool {
		return out.Relations[i].Kind+out.Relations[i].From+out.Relations[i].To < out.Relations[j].Kind+out.Relations[j].From+out.Relations[j].To
	})
	sort.Strings(out.Analysis.ReachableOutcomes)
	sort.Slice(out.Analysis.OutcomeCauses, func(i, j int) bool {
		return out.Analysis.OutcomeCauses[i].Precedence < out.Analysis.OutcomeCauses[j].Precedence
	})
}
