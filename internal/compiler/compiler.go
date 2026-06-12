package compiler

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
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
	program           ast.Program
	diags             *diagnostic.Bag
	symbols           map[string]map[string]diagnostic.Span
	policies          map[string]ast.PolicyDecl
	policyAttachments map[string][]ir.PolicyAttachmentIR
	observations      []ir.ObservationIR
}

func newCompiler(program ast.Program, diags *diagnostic.Bag) *compiler {
	c := &compiler{
		program:           program,
		diags:             diags,
		symbols:           map[string]map[string]diagnostic.Span{},
		policies:          map[string]ast.PolicyDecl{},
		policyAttachments: map[string][]ir.PolicyAttachmentIR{},
	}
	c.indexSymbols()
	for _, policy := range program.Policies {
		if _, exists := c.policies[policy.Name]; !exists {
			c.policies[policy.Name] = policy
		}
	}
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
		if policy.Family == "" {
			c.diags.Error("DCL_SEM_POLICY_FAMILY_REQUIRED", "policy must declare a family", policy.Span, policy.Name)
		} else if !validPolicyFamily(policy.Family) {
			c.diags.Error("DCL_SEM_POLICY_FAMILY_UNKNOWN", "unknown policy family "+policy.Family, policy.Span, policy.Name)
		}
		c.validatePolicyConcerns(policy)
		out.Policies = append(out.Policies, c.policyIR(policy))
		out.Symbols = append(out.Symbols, symbol("policy", policy.Name, policy.Span))
	}
	for _, capability := range c.program.Capabilities {
		out.Capabilities = append(out.Capabilities, c.capabilityIR(capability))
		out.Symbols = append(out.Symbols, symbol("capability", capability.Name, capability.Span))
	}
	out.Observations = append(out.Observations, c.observations...)
	c.applyPolicyAttachments(&out)
	c.deriveEffectivePolicies(&out)

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
	metricNames := map[string]diagnostic.Span{}

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
			c.validatePolicyTarget(cap, policy, localOutcomes, localEffects)
		}
		c.validatePolicyAttachmentConcerns(cap, policy, localOutcomes)
		c.recordPolicyAttachment(cap, policy)
		capIR.Policies = append(capIR.Policies, ir.PolicyUseIR{Policy: policy.Name, TargetKind: policy.TargetKind, TargetName: policyTargetName(cap, policy)})
	}

	c.validateWhen(cap, localOutcomes, localRules, localEffects, localPolicies, &capIR)
	if cap.Lifecycle != nil {
		capIR.Lifecycle = c.lifecycleIR(cap, localOutcomes)
	}
	for _, observation := range cap.Observe {
		c.validateObservation(cap, observation, localOutcomes, localEffects, metricNames)
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
			if branch.SourceKind == "policy" {
				sourceKind = "policy"
				if !c.hasGlobal("policy", branch.SourceName) {
					c.diags.Error("DCL_SEM_POLICY_CAUSATION_POLICY_UNKNOWN", "when branch references unknown policy", branch.Span, branch.SourceName)
				}
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
				case "denied", "denies":
					sourceKind = "policy"
					if _, ok := policies[branch.SourceName]; !ok && !c.hasGlobal("policy", branch.SourceName) {
						c.diags.Error("DCL_SEM_UNKNOWN_POLICY", "when branch references unknown policy", branch.Span, branch.SourceName)
					}
				default:
					c.diags.Error("DCL_SEM_CAUSATION_DECISION_UNKNOWN", "unknown v0.2 causation decision", branch.Span, branch.Decision)
				}
			}
		}
		if _, ok := outcomes[branch.Outcome]; !ok {
			if sourceKind == "policy" {
				c.diags.Error("DCL_SEM_POLICY_CAUSATION_OUTCOME_UNKNOWN", "policy causation references unknown outcome", branch.Span, branch.Outcome)
			} else {
				c.diags.Error("DCL_SEM_UNKNOWN_OUTCOME", "when branch references unknown outcome", branch.Span, branch.Outcome)
			}
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

func (c *compiler) validatePolicyTarget(cap ast.CapabilityDecl, policy ast.PolicyUse, outcomes map[string]ast.OutcomeDecl, effects map[string]ast.EffectUse) {
	switch policy.TargetKind {
	case "capability":
		if policy.TargetName == "" {
			return
		}
		if policy.TargetName != cap.Name {
			c.diags.Error("DCL_SEM_POLICY_TARGET_UNKNOWN", "policy target capability is not the current capability", policy.Span, policy.TargetName)
		}
	case "effect":
		if _, ok := effects[policy.TargetName]; !ok {
			c.diags.Error("DCL_SEM_POLICY_TARGET_UNKNOWN", "policy target effect is not used by this capability", policy.Span, policy.TargetName)
		}
	case "outcome":
		if _, ok := outcomes[policy.TargetName]; !ok {
			c.diags.Error("DCL_SEM_POLICY_TARGET_UNKNOWN", "policy target outcome is not declared by this capability", policy.Span, policy.TargetName)
		}
	case "event":
		if !c.hasGlobal("event", policy.TargetName) {
			c.diags.Error("DCL_SEM_POLICY_TARGET_UNKNOWN", "policy target event is not declared", policy.Span, policy.TargetName)
		}
	case "lifecycle":
		if cap.Lifecycle == nil {
			c.diags.Error("DCL_SEM_POLICY_TARGET_UNKNOWN", "policy target lifecycle is not declared by this capability", policy.Span, cap.Name)
		}
	default:
		c.diags.Error("DCL_SEM_POLICY_ATTACHMENT_INVALID", "unsupported policy attachment target kind", policy.Span, policy.TargetKind)
	}
}

func (c *compiler) validateObservation(cap ast.CapabilityDecl, observation ast.ObservationDecl, outcomes map[string]ast.OutcomeDecl, effects map[string]ast.EffectUse, metricNames map[string]diagnostic.Span) {
	if !validObservationType(observation.ObservationType) {
		c.diags.Error("DCL_SEM_OBSERVE_TYPE_UNSUPPORTED", "unsupported observation type", observation.Span, observation.ObservationType)
	}
	targetReference := c.resolveObservationTarget(cap, observation, outcomes, effects)
	metricName := observation.MetricName
	if metricName == "" {
		metricName = derivedMetricName(cap.Name, observation, targetReference)
	}
	if old, exists := metricNames[metricName]; exists {
		c.diags.Error("DCL_SEM_OBSERVE_METRIC_DUPLICATE", fmt.Sprintf("duplicate observation metric name; first declared at %s:%d:%d", old.File, old.Line, old.Column), observation.Span, metricName)
	} else {
		metricNames[metricName] = observation.Span
	}
	c.observations = append(c.observations, ir.ObservationIR{
		TargetKind:      observation.TargetKind,
		TargetReference: targetReference,
		ObservationType: observation.ObservationType,
		MetricName:      metricName,
	})
}

func (c *compiler) resolveObservationTarget(cap ast.CapabilityDecl, observation ast.ObservationDecl, outcomes map[string]ast.OutcomeDecl, effects map[string]ast.EffectUse) string {
	switch observation.TargetKind {
	case "capability":
		if observation.TargetName != "" && observation.TargetName != cap.Name {
			c.diags.Error("DCL_SEM_OBSERVE_TARGET_UNKNOWN", "observation target capability is not the current capability", observation.Span, observation.TargetName)
		}
		return id("capability", cap.Name)
	case "effect":
		if _, ok := effects[observation.TargetName]; !ok {
			c.diags.Error("DCL_SEM_OBSERVE_TARGET_UNKNOWN", "observation target effect is not used by this capability", observation.Span, observation.TargetName)
		}
		return id("effect", observation.TargetName)
	case "outcome":
		if _, ok := outcomes[observation.TargetName]; !ok {
			c.diags.Error("DCL_SEM_OBSERVE_TARGET_UNKNOWN", "observation target outcome is not declared by this capability", observation.Span, observation.TargetName)
		}
		return id("outcome", cap.Name+"."+observation.TargetName)
	case "event":
		if !c.hasGlobal("event", observation.TargetName) {
			c.diags.Error("DCL_SEM_OBSERVE_TARGET_UNKNOWN", "observation target event is not declared", observation.Span, observation.TargetName)
		}
		return id("event", observation.TargetName)
	case "lifecycle":
		if cap.Lifecycle == nil {
			c.diags.Error("DCL_SEM_OBSERVE_TARGET_UNKNOWN", "observation target lifecycle is not declared by this capability", observation.Span, cap.Name)
		}
		return id("lifecycle", cap.Name)
	default:
		c.diags.Error("DCL_SEM_OBSERVE_TARGET_UNKNOWN", "unsupported observation target kind", observation.Span, observation.TargetKind)
		return observation.TargetKind + ":" + observation.TargetName
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

func (c *compiler) validatePolicyConcerns(policy ast.PolicyDecl) {
	seen := map[string]diagnostic.Span{}
	for _, concern := range policy.Concerns {
		if old, exists := seen[concern.Name]; exists {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_CONFLICT", fmt.Sprintf("conflicting concern %s; first declared at %s:%d:%d", concern.Name, old.File, old.Line, old.Column), concern.Span, concern.Name)
		}
		seen[concern.Name] = concern.Span
		if !knownConcern(concern.Name) {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_UNKNOWN", "unknown policy concern", concern.Span, concern.Name)
			continue
		}
		if policy.Family != "" && validPolicyFamily(policy.Family) && !concernAllowedInFamily(concern.Name, policy.Family) {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_WRONG_FAMILY", "concern used under wrong policy family", concern.Span, concern.Name)
			continue
		}
		c.validateConcernShape(policy, concern)
	}
	if concern, ok := findConcern(policy, "backoff"); ok {
		if _, hasRetry := findConcern(policy, "retry"); !hasRetry {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_PARAM_REQUIRED", "backoff requires retry", concern.Span, concern.Name)
		}
	}
}

func (c *compiler) validateConcernShape(policy ast.PolicyDecl, concern ast.ConcernDecl) {
	c.validateConcernParameters(concern)
	switch concern.Name {
	case "retry":
		attempts, ok := parameter(concern, "attempts")
		if !ok {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_PARAM_REQUIRED", "retry requires attempts", concern.Span, concern.Name)
		} else if len(attempts.Values) != 1 || !positiveInteger(attempts.Values[0]) {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_VALUE_INVALID", "retry attempts must be a positive integer", attempts.Span, attempts.Name)
		}
		if backoff, ok := parameter(concern, "backoff"); ok && (len(backoff.Values) != 1 || backoff.Values[0] == "") {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_VALUE_INVALID", "backoff requires a strategy", backoff.Span, backoff.Name)
		}
	case "backoff":
		values := scalarValues(concern)
		if len(values) != 1 || values[0] == "" {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_MALFORMED", "backoff requires a strategy", concern.Span, concern.Name)
		}
	case "timeout", "budget":
		c.validatePositiveDurationConcern(concern)
	case "idempotency", "authentication", "authorization", "encryption", "audit", "approval", "evidence", "masking", "minimization", "deletion", "dependency_tolerance":
		c.validateRequiredAllowedForbidden(concern)
	case "degradation", "queue":
		c.validateAllowedForbidden(concern)
	case "circuit_breaker":
		if policy.Family != "reliability" {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_WRONG_FAMILY", "circuit_breaker is valid only under reliability", concern.Span, concern.Name)
		}
		c.validateCircuitBreaker(concern)
	case "fallback":
		values := scalarValues(concern)
		if len(values) != 1 || values[0] == "" {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_MALFORMED", "fallback requires an outcome name", concern.Span, concern.Name)
		}
	case "concurrency":
		c.validatePositiveIntegerConcern(concern, "concurrency must be positive")
	case "rate_limit":
		c.validateRateLimit(concern)
	case "backpressure":
		values := scalarValues(concern)
		if len(values) != 1 || values[0] == "" {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_PARAM_REQUIRED", "backpressure requires a strategy", concern.Span, concern.Name)
		}
	case "latency":
		values := scalarValues(concern)
		if len(values) != 3 || values[1] != "under" || !positiveDuration([]string{values[2]}) {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_VALUE_INVALID", "latency target must be valid", concern.Span, concern.Name)
		}
	case "throughput":
		values := scalarValues(concern)
		if len(values) != 4 || values[0] != "above" || !positiveInteger(values[1]) || values[2] != "per" || values[3] == "" {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_VALUE_INVALID", "throughput target must be valid", concern.Span, concern.Name)
		}
	case "classification":
		c.validateEnumConcern(concern, map[string]bool{"public": true, "internal": true, "confidential": true, "restricted": true}, "classification value must be valid")
	case "retention":
		values := scalarValues(concern)
		if len(values) != 2 || !positiveInteger(values[0]) || !validPeriodUnit(values[1]) {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_VALUE_INVALID", "retention period must be valid", concern.Span, concern.Name)
		}
	case "sensitivity":
		c.validateEnumConcern(concern, map[string]bool{"none": true, "personal": true, "sensitive": true, "special_category": true}, "sensitivity value must be valid")
	case "compensation":
		values := scalarValues(concern)
		if len(values) == 0 {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_MALFORMED", "compensation requires a value", concern.Span, concern.Name)
		}
	}
}

func (c *compiler) validateConcernParameters(concern ast.ConcernDecl) {
	allowed := map[string]bool{}
	switch concern.Name {
	case "retry":
		allowed["attempts"] = true
		allowed["backoff"] = true
	case "circuit_breaker":
		allowed["opens"] = true
		allowed["resets"] = true
	default:
		allowed["value"] = true
	}
	for _, param := range concern.Parameters {
		if !allowed[param.Name] {
			c.diags.Error("DCL_SEM_POLICY_CONCERN_UNSUPPORTED", "unsupported concern parameter", param.Span, param.Name)
		}
	}
}

func (c *compiler) validateRateLimit(concern ast.ConcernDecl) {
	values := scalarValues(concern)
	if len(values) != 3 || !positiveInteger(values[0]) || values[1] != "per" || values[2] == "" {
		c.diags.Error("DCL_SEM_POLICY_CONCERN_VALUE_INVALID", "rate_limit must be positive and use 'per <unit>'", concern.Span, concern.Name)
	}
}

func (c *compiler) validatePositiveIntegerConcern(concern ast.ConcernDecl, message string) {
	values := scalarValues(concern)
	if len(values) != 1 || !positiveInteger(values[0]) {
		c.diags.Error("DCL_SEM_POLICY_CONCERN_VALUE_INVALID", message, concern.Span, concern.Name)
	}
}

func (c *compiler) validatePositiveDurationConcern(concern ast.ConcernDecl) {
	values := scalarValues(concern)
	if !positiveDuration(values) {
		c.diags.Error("DCL_SEM_POLICY_CONCERN_VALUE_INVALID", concern.Name+" must be a positive duration", concern.Span, concern.Name)
	}
}

func (c *compiler) validateAllowedForbidden(concern ast.ConcernDecl) {
	c.validateEnumConcern(concern, map[string]bool{"allowed": true, "forbidden": true}, concern.Name+" must be allowed or forbidden")
}

func (c *compiler) validateRequiredAllowedForbidden(concern ast.ConcernDecl) {
	c.validateEnumConcern(concern, map[string]bool{"required": true, "allowed": true, "forbidden": true}, concern.Name+" value must be valid")
}

func (c *compiler) validateEnumConcern(concern ast.ConcernDecl, allowed map[string]bool, message string) {
	values := scalarValues(concern)
	if len(values) != 1 || !allowed[values[0]] {
		c.diags.Error("DCL_SEM_POLICY_CONCERN_VALUE_INVALID", message, concern.Span, concern.Name)
	}
}

func (c *compiler) validateCircuitBreaker(concern ast.ConcernDecl) {
	opens, hasOpens := parameter(concern, "opens")
	if !hasOpens || len(opens.Values) != 3 || opens.Values[0] != "after" || !positiveInteger(opens.Values[1]) || opens.Values[2] != "failures" {
		c.diags.Error("DCL_SEM_POLICY_CONCERN_PARAM_REQUIRED", "circuit_breaker requires opens after <positive integer> failures", concern.Span, concern.Name)
	}
	resets, hasResets := parameter(concern, "resets")
	if !hasResets || len(resets.Values) != 2 || resets.Values[0] != "after" || !positiveDuration(resets.Values[1:]) {
		c.diags.Error("DCL_SEM_POLICY_CONCERN_PARAM_REQUIRED", "circuit_breaker requires resets after <positive duration>", concern.Span, concern.Name)
	}
}

func (c *compiler) validatePolicyAttachmentConcerns(cap ast.CapabilityDecl, use ast.PolicyUse, outcomes map[string]ast.OutcomeDecl) {
	policy, ok := c.policies[use.Name]
	if !ok {
		return
	}
	for _, concern := range policy.Concerns {
		switch concern.Name {
		case "fallback":
			values := scalarValues(concern)
			if len(values) == 1 {
				if _, ok := outcomes[values[0]]; !ok {
					c.diags.Error("DCL_SEM_POLICY_FALLBACK_OUTCOME_UNKNOWN", "fallback references an unresolved outcome", concern.Span, values[0])
				}
			}
		case "circuit_breaker":
			if use.TargetKind != "effect" {
				c.diags.Error("DCL_SEM_POLICY_CONCERN_ATTACHMENT_INVALID", "circuit_breaker may only govern effects", use.Span, use.Name)
			}
		}
	}
}

func (c *compiler) recordPolicyAttachment(cap ast.CapabilityDecl, use ast.PolicyUse) {
	if !c.hasGlobal("policy", use.Name) {
		return
	}
	c.policyAttachments[use.Name] = append(c.policyAttachments[use.Name], ir.PolicyAttachmentIR{
		Capability: cap.Name,
		TargetKind: use.TargetKind,
		TargetName: policyTargetName(cap, use),
	})
}

func (c *compiler) policyIR(policy ast.PolicyDecl) ir.PolicyIR {
	out := ir.PolicyIR{ID: id("policy", policy.Name), Name: policy.Name, Family: policy.Family, Concern: policy.Concern}
	for _, concern := range policy.Concerns {
		out.Concerns = append(out.Concerns, concernIR(policy.Family, concern))
		if objective := objectiveIR(concern); objective.Concern != "" {
			out.Objectives = append(out.Objectives, objective)
		}
		out.DerivedObligations = append(out.DerivedObligations, obligationIR(concern, "", ""))
	}
	return out
}

func (c *compiler) applyPolicyAttachments(out *ir.ProgramIR) {
	for i := range out.Policies {
		attachments := append([]ir.PolicyAttachmentIR(nil), c.policyAttachments[out.Policies[i].Name]...)
		sort.Slice(attachments, func(a, b int) bool {
			x, y := attachments[a], attachments[b]
			return x.Capability+x.TargetKind+x.TargetName < y.Capability+y.TargetKind+y.TargetName
		})
		out.Policies[i].AttachmentPoints = attachments
		if len(attachments) == 0 {
			continue
		}
		var obligations []ir.DerivedObligationIR
		for _, concern := range out.Policies[i].Concerns {
			for _, attachment := range attachments {
				obligations = append(obligations, obligationIRFromConcernIR(concern, attachment.TargetKind, attachment.TargetName))
			}
		}
		if len(obligations) > 0 {
			out.Policies[i].DerivedObligations = obligations
		}
	}
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

func validPolicyFamily(family string) bool {
	switch family {
	case "reliability", "availability", "scalability", "performance", "security", "compliance", "governance", "data_protection":
		return true
	default:
		return false
	}
}

func validObservationType(observationType string) bool {
	switch observationType {
	case "count", "duration", "violations", "failures", "transitions":
		return true
	default:
		return false
	}
}

func knownConcern(name string) bool {
	switch name {
	case "retry", "backoff", "timeout", "idempotency", "compensation", "circuit_breaker",
		"degradation", "fallback", "dependency_tolerance",
		"concurrency", "rate_limit", "queue", "backpressure",
		"latency", "throughput", "budget",
		"authentication", "authorization", "classification", "encryption",
		"audit", "retention", "approval", "evidence",
		"sensitivity", "masking", "minimization", "deletion":
		return true
	default:
		return false
	}
}

func concernAllowedInFamily(name, family string) bool {
	switch family {
	case "reliability":
		return in(name, "retry", "backoff", "timeout", "idempotency", "compensation", "circuit_breaker")
	case "availability":
		return in(name, "degradation", "fallback", "dependency_tolerance")
	case "scalability":
		return in(name, "concurrency", "rate_limit", "queue", "backpressure")
	case "performance":
		return in(name, "latency", "throughput", "budget")
	case "security":
		return in(name, "authentication", "authorization", "classification", "encryption")
	case "compliance", "governance":
		return in(name, "audit", "retention", "approval", "evidence")
	case "data_protection":
		return in(name, "sensitivity", "masking", "minimization", "retention", "deletion")
	default:
		return false
	}
}

func findConcern(policy ast.PolicyDecl, name string) (ast.ConcernDecl, bool) {
	for _, concern := range policy.Concerns {
		if concern.Name == name {
			return concern, true
		}
	}
	return ast.ConcernDecl{}, false
}

func parameter(concern ast.ConcernDecl, name string) (ast.ConcernParameter, bool) {
	for _, param := range concern.Parameters {
		if param.Name == name {
			return param, true
		}
	}
	return ast.ConcernParameter{}, false
}

func scalarValues(concern ast.ConcernDecl) []string {
	if param, ok := parameter(concern, "value"); ok {
		return param.Values
	}
	return nil
}

func positiveInteger(value string) bool {
	n, err := strconv.Atoi(value)
	return err == nil && n > 0
}

func positiveDuration(values []string) bool {
	switch len(values) {
	case 1:
		number, unit := splitNumberUnit(values[0])
		return positiveInteger(number) && validDurationUnit(unit)
	case 2:
		return positiveInteger(values[0]) && validDurationUnit(values[1])
	default:
		return false
	}
}

func splitNumberUnit(value string) (string, string) {
	for i, r := range value {
		if r < '0' || r > '9' {
			return value[:i], value[i:]
		}
	}
	return value, ""
}

func validDurationUnit(unit string) bool {
	switch unit {
	case "ms", "millisecond", "milliseconds", "s", "second", "seconds", "m", "minute", "minutes", "h", "hour", "hours":
		return true
	default:
		return false
	}
}

func validPeriodUnit(unit string) bool {
	switch unit {
	case "day", "days", "month", "months", "year", "years":
		return true
	default:
		return false
	}
}

func concernIR(family string, concern ast.ConcernDecl) ir.ConcernIR {
	out := ir.ConcernIR{Name: concern.Name, Family: family, SourceLocation: concern.Span}
	for _, param := range concern.Parameters {
		out.Parameters = append(out.Parameters, ir.ConcernParameterIR{Name: param.Name, Values: append([]string(nil), param.Values...)})
	}
	return out
}

func objectiveIR(concern ast.ConcernDecl) ir.ObjectiveIR {
	switch concern.Name {
	case "latency", "throughput", "budget", "retention":
		return ir.ObjectiveIR{Concern: concern.Name, Values: scalarOrParameterValues(concern)}
	default:
		return ir.ObjectiveIR{}
	}
}

func obligationIR(concern ast.ConcernDecl, targetKind, targetName string) ir.DerivedObligationIR {
	return ir.DerivedObligationIR{
		Concern:    concern.Name,
		Obligation: obligationName(concern.Name),
		TargetKind: targetKind,
		TargetName: targetName,
	}
}

func obligationIRFromConcernIR(concern ir.ConcernIR, targetKind, targetName string) ir.DerivedObligationIR {
	return ir.DerivedObligationIR{
		Concern:    concern.Name,
		Obligation: obligationName(concern.Name),
		TargetKind: targetKind,
		TargetName: targetName,
	}
}

func obligationName(concern string) string {
	switch concern {
	case "retry", "backoff", "timeout", "idempotency", "compensation":
		return "verify reliability behavior"
	case "circuit_breaker":
		return "protect dependency effect"
	case "latency", "throughput", "budget":
		return "verify performance objective"
	case "audit", "evidence":
		return "preserve governance evidence"
	case "retention", "deletion", "masking", "minimization":
		return "verify data protection obligation"
	default:
		return "verify policy concern"
	}
}

func scalarOrParameterValues(concern ast.ConcernDecl) []string {
	if values := scalarValues(concern); len(values) > 0 {
		return append([]string(nil), values...)
	}
	var out []string
	for _, param := range concern.Parameters {
		out = append(out, param.Name)
		out = append(out, param.Values...)
	}
	return out
}

func in(value string, choices ...string) bool {
	for _, choice := range choices {
		if value == choice {
			return true
		}
	}
	return false
}

func derivedMetricName(capability string, observation ast.ObservationDecl, targetReference string) string {
	target := observation.TargetName
	if target == "" {
		target = strings.TrimPrefix(targetReference, observation.TargetKind+":")
	}
	parts := []string{capability, observation.TargetKind, target, observation.ObservationType}
	var clean []string
	for _, part := range parts {
		if part != "" {
			clean = append(clean, strings.ReplaceAll(part, ".", "_"))
		}
	}
	return strings.ToLower(strings.Join(clean, "_"))
}

func policyTargetName(cap ast.CapabilityDecl, policy ast.PolicyUse) string {
	switch policy.TargetKind {
	case "capability", "lifecycle":
		return cap.Name
	default:
		return policy.TargetName
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
	sortEffectivePolicyIR(out.EffectivePolicies)
	sort.Slice(out.Observations, func(i, j int) bool {
		a, b := out.Observations[i], out.Observations[j]
		return a.TargetKind+a.TargetReference+a.ObservationType+a.MetricName < b.TargetKind+b.TargetReference+b.ObservationType+b.MetricName
	})
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
