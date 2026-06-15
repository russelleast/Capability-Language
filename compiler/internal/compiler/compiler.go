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
	"capabilitylanguage/internal/version"
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
	contexts          map[string]*contextInfo
	dependencies      map[string]map[string]diagnostic.Span
	symbolsByContext  map[string]map[string]map[string]*symbolInfo
	symbolsByFQN      map[string]map[string]*symbolInfo
	symbolsByKindName map[string]map[string][]*symbolInfo
	capabilities      map[string]ast.CapabilityDecl
	lifecycleOwners   map[string]ast.CapabilityDecl
	policies          map[string]ast.PolicyDecl
	policyAttachments map[string][]ir.PolicyAttachmentIR
	observations      []ir.ObservationIR
	referencedDeps    map[string]map[string]map[string]bool
}

type contextInfo struct {
	Name   string
	Parent string
	Span   diagnostic.Span
}

type symbolInfo struct {
	Kind       string
	Name       string
	Context    string
	Visibility string
	FQN        string
	Span       diagnostic.Span
}

func newCompiler(program ast.Program, diags *diagnostic.Bag) *compiler {
	c := &compiler{
		program:           program,
		diags:             diags,
		contexts:          map[string]*contextInfo{},
		dependencies:      map[string]map[string]diagnostic.Span{},
		symbolsByContext:  map[string]map[string]map[string]*symbolInfo{},
		symbolsByFQN:      map[string]map[string]*symbolInfo{},
		symbolsByKindName: map[string]map[string][]*symbolInfo{},
		capabilities:      map[string]ast.CapabilityDecl{},
		lifecycleOwners:   map[string]ast.CapabilityDecl{},
		policies:          map[string]ast.PolicyDecl{},
		policyAttachments: map[string][]ir.PolicyAttachmentIR{},
		referencedDeps:    map[string]map[string]map[string]bool{},
	}
	c.indexContexts()
	c.indexSymbols()
	c.validateLanguageVersions()
	for _, policy := range program.Policies {
		key := policyKey(policy.Meta.ContextName, policy.Name)
		if _, exists := c.policies[key]; !exists {
			c.policies[key] = policy
		}
	}
	for _, cap := range program.Capabilities {
		key := symbolIdentity(cap.Meta.ContextName, cap.Name)
		if _, exists := c.capabilities[key]; !exists {
			c.capabilities[key] = cap
		}
	}
	c.validateDependencies()
	return c
}

func (c *compiler) validateLanguageVersions() {
	for _, decl := range c.program.Languages {
		if decl.Name != version.LanguageName {
			continue
		}
		if compareVersion(decl.Version, version.LanguageVersion) > 0 {
			c.diags.Error("DCL_VERSION_UNSUPPORTED", fmt.Sprintf("language version %s is newer than supported version %s", decl.Version, version.LanguageVersion), decl.Span, decl.Version)
		}
	}
}

func (c *compiler) buildIR() ir.ProgramIR {
	out := ir.ProgramIR{
		Version:  ir.VersionIR{Language: version.LanguageVersion, Compiler: version.CompilerVersion},
		Modules:  []ir.ModuleIR{{ID: "module:main", Files: c.program.Files}},
		Analysis: map[string]ir.PortabilityFacts{"default": {Classification: "portable"}},
	}

	c.emitTopLevelDeclarations(&out)
	c.emitCapabilities(&out)
	c.finalizeProgram(&out)

	sortProgramIR(&out)
	return out
}

func (c *compiler) emitTopLevelDeclarations(out *ir.ProgramIR) {
	for _, shape := range c.program.Shapes {
		if isBuiltinType(shape.Name) {
			c.diags.Error("DCL_SEM_TYPE_BUILTIN_SHADOWED", "shape cannot shadow a built-in type", shape.Span, shape.Name)
		}
		out.Shapes = append(out.Shapes, ir.ShapeIR{ID: id("shape", symbolIdentity(shape.Meta.ContextName, shape.Name)), Name: shape.Name, Fields: fieldsIR(shape.Fields)})
		out.Symbols = append(out.Symbols, c.symbolIR("shape", shape.Name, shape.Meta.ContextName, shape.Span))
		c.validateFields(shape.Fields, shape.Meta.ContextName)
	}
	for _, actor := range c.program.Actors {
		if actor.Kind == "" {
			c.diags.Error("DCL_SEM_ACTOR_KIND_REQUIRED", "actor must declare kind", actor.Span, actor.Name)
		}
		out.Actors = append(out.Actors, ir.ActorIR{ID: id("actor", symbolIdentity(actor.Meta.ContextName, actor.Name)), Name: actor.Name, Classification: actor.Kind})
		out.Symbols = append(out.Symbols, c.symbolIR("actor", actor.Name, actor.Meta.ContextName, actor.Span))
	}
	for _, effect := range c.program.Effects {
		if effect.Kind == "" {
			c.diags.Error("DCL_SEM_EFFECT_KIND_REQUIRED", "effect must declare kind", effect.Span, effect.Name)
		}
		out.Effects = append(out.Effects, ir.EffectIR{ID: id("effect", symbolIdentity(effect.Meta.ContextName, effect.Name)), Name: effect.Name, Type: c.normalizedEffectKind(effect)})
		out.Symbols = append(out.Symbols, c.symbolIR("effect", effect.Name, effect.Meta.ContextName, effect.Span))
	}
	for _, event := range c.program.Events {
		c.validatePayload(event.Payload, event.Meta.ContextName)
		out.Events = append(out.Events, ir.EventIR{ID: id("event", symbolIdentity(event.Meta.ContextName, event.Name)), Name: event.Name, Payload: payloadIR(event.Payload)})
		out.Symbols = append(out.Symbols, c.symbolIR("event", event.Name, event.Meta.ContextName, event.Span))
	}
	for _, policy := range c.program.Policies {
		if policy.Family == "" {
			c.diags.Error("DCL_SEM_POLICY_FAMILY_REQUIRED", "policy must declare a family", policy.Span, policy.Name)
		} else if !validPolicyFamily(policy.Family) {
			c.diags.Error("DCL_SEM_POLICY_FAMILY_UNKNOWN", "unknown policy family "+policy.Family, policy.Span, policy.Name)
		}
		c.validatePolicyConcerns(policy)
		out.Policies = append(out.Policies, c.policyIR(policy))
		out.Symbols = append(out.Symbols, c.symbolIR("policy", policy.Name, policy.Meta.ContextName, policy.Span))
	}
}

func (c *compiler) emitCapabilities(out *ir.ProgramIR) {
	for _, capability := range c.program.Capabilities {
		out.Capabilities = append(out.Capabilities, c.capabilityIR(capability))
		out.Symbols = append(out.Symbols, c.symbolIR("capability", capability.Name, capability.Meta.ContextName, capability.Span))
	}
}

func (c *compiler) finalizeProgram(out *ir.ProgramIR) {
	out.Observations = append(out.Observations, c.observations...)
	c.applyPolicyAttachments(out)
	c.deriveEffectivePolicies(out)
	c.emitUnusedDependencyWarnings()
	out.Contexts = c.contextIR()
	out.Dependencies = c.dependencyIR()
}

func (c *compiler) capabilityIR(cap ast.CapabilityDecl) ir.CapabilityIR {
	context := declContext(cap.Meta.ContextName)
	capIR := ir.CapabilityIR{
		ID:       id("capability", symbolIdentity(context, cap.Name)),
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
		c.requireInContext("actor", intent.Actor, context, intent.Span)
		c.requireInContext("shape", intent.InputType, context, intent.Span)
		capIR.Intents = append(capIR.Intents, ir.IntentIR{
			ID: id("intent", symbolIdentity(context, cap.Name+"."+intent.Name)), Name: intent.Name, Capability: cap.Name,
			InputShape: intent.InputType, Actor: intent.Actor, Source: "declared",
		})
	}
	for _, role := range cap.Actors {
		c.requireInContext("actor", role.Actor, context, role.Span)
		localActorRoles[role.Role] = role
		capIR.Actors = append(capIR.Actors, ir.ActorRoleIR{Role: role.Role, Actor: role.Actor})
	}
	for _, outcome := range cap.Outcomes {
		localOutcomes[outcome.Name] = outcome
		c.validatePayload(outcome.Payload, context)
		capIR.Outcomes = append(capIR.Outcomes, ir.OutcomeIR{
			ID: id("outcome", symbolIdentity(context, cap.Name+"."+outcome.Name)), Name: outcome.Name, Capability: cap.Name, Payload: payloadIR(outcome.Payload),
		})
	}
	for _, rule := range cap.Rules {
		localRules[rule.Name] = rule
		capIR.Invariants = append(capIR.Invariants, ir.InvariantIR{ID: id("rule", symbolIdentity(context, cap.Name+"."+rule.Name)), Name: rule.Name, Capability: cap.Name, Assertion: rule.Expression})
		c.validateRuleExpression(rule, localActorRoles)
	}
	for _, effect := range cap.Effects {
		localEffects[effect.Name] = effect
	}
	for _, event := range cap.Events {
		if _, ok := c.resolve("event", event.Name, context, event.Span, false); ok {
			capIR.EmittedEvents = append(capIR.EmittedEvents, ir.CapabilityEventIR{Event: event.Name, Source: cap.Name})
		} else {
			c.diags.Error("DCL_SEM_CAPABILITY_EVENT_UNKNOWN", "capability emits an unknown event", event.Span, event.Name)
		}
	}
	validateDuplicateEmittedEvents(c.diags, cap.Events)
	for _, effect := range cap.Effects {
		c.requireInContext("effect", effect.Name, context, effect.Span)
		if effect.After != "" {
			if _, ok := localEffects[effect.After]; !ok {
				c.diags.Error("DCL_SEM_EFFECT_ORDER_UNKNOWN", "effect ordering references an effect not used in this capability", effect.Span, effect.After)
			}
		}
		capIR.Effects = append(capIR.Effects, ir.EffectUseIR{Effect: effect.Name, After: effect.After, Origin: cap.Name, Ordering: ordering(effect)})
	}
	for _, policy := range cap.Policies {
		localPolicies[policy.Name] = policy
		c.requireInContext("policy", policy.Name, context, policy.Span)
		if policy.TargetKind != "" {
			c.validatePolicyTarget(cap, policy, localOutcomes, localEffects)
		}
		c.validatePolicyAttachmentConcerns(cap, policy, localOutcomes)
		c.recordPolicyAttachment(cap, policy)
		capIR.Policies = append(capIR.Policies, ir.PolicyUseIR{Policy: policy.Name, TargetKind: policy.TargetKind, TargetName: policyTargetName(cap, policy)})
	}

	c.validateWhen(cap, localOutcomes, localRules, localEffects, localPolicies, lifecycleCausedOutcomes(cap.Lifecycle), &capIR)
	if cap.Lifecycle != nil {
		capIR.Lifecycle = c.lifecycleIR(cap, localOutcomes)
	}
	for _, observation := range cap.Observe {
		c.validateObservation(cap, observation, localOutcomes, localEffects, metricNames)
	}

	sortCapabilityIR(&capIR)
	return capIR
}

func (c *compiler) validateWhen(cap ast.CapabilityDecl, outcomes map[string]ast.OutcomeDecl, rules map[string]ast.RuleDecl, effects map[string]ast.EffectUse, policies map[string]ast.PolicyUse, lifecycleCaused map[string]bool, capIR *ir.CapabilityIR) {
	context := declContext(cap.Meta.ContextName)
	caused := map[string]bool{}
	for outcome := range lifecycleCaused {
		caused[outcome] = true
		capIR.Analysis.OutcomeCauses = append(capIR.Analysis.OutcomeCauses, ir.OutcomeCause{Outcome: outcome, Source: "lifecycle:deadline", Condition: "deadline", Precedence: len(cap.When)})
		capIR.Analysis.ReachableOutcomes = append(capIR.Analysis.ReachableOutcomes, outcome)
		capIR.Relations = append(capIR.Relations, ir.RelationIR{Kind: "causes", From: "lifecycle:deadline", To: outcome, Condition: "deadline"})
	}
	otherwiseSeen := false
	alwaysSeen := false
	for i, branch := range cap.When {
		sourceKind := branch.SourceKind
		if branch.Always {
			if alwaysSeen {
				c.diags.Error("DCL_SEM_ALWAYS_DUPLICATE", "always branch appears more than once", branch.Span, cap.Name)
			}
			if len(cap.When) > 1 {
				c.diags.Error("DCL_SEM_ALWAYS_WITH_OTHER_BRANCHES", "always branch must not be combined with other when branches", branch.Span, cap.Name)
			}
			alwaysSeen = true
		} else if branch.Otherwise {
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
				if _, ok := c.resolve("policy", branch.SourceName, context, branch.Span, false); !ok {
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
					if _, ok := policies[branch.SourceName]; !ok {
						_, ok = c.resolve("policy", branch.SourceName, context, branch.Span, false)
						if !ok {
							c.diags.Error("DCL_SEM_UNKNOWN_POLICY", "when branch references unknown policy", branch.Span, branch.SourceName)
						}
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
		if branch.Always {
			source = "capability:" + cap.Name
			condition = "always"
		} else if branch.Otherwise {
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
	context := declContext(cap.Meta.ContextName)
	stepDecls := lifecycleStepDecls(lc)
	states := lifecycleStateSet(stepDecls)
	if lc.Begin != "" {
		states[lc.Begin] = true
	}
	for _, end := range lc.Ends {
		states[end] = true
	}
	if lc.Begin == "" {
		c.diags.Error("DCL_SEM_LIFECYCLE_BEGIN_REQUIRED", "lifecycle must declare an initial state", lc.Span, cap.Name)
	}
	lifecycleName := lifecycleIRName(cap)
	lifecycleIDName := cap.Name
	if lc.Supervised && lc.Name != "" {
		lifecycleIDName = lc.Name
		c.validateLifecycleOwnership(cap)
	}
	if lc.Supervised && lc.Identity == "" {
		c.diags.Error("DCL_SEM_UNCORRELATED_TRANSITION_SOURCE", "supervised lifecycle requires identity binding", lc.Span, lifecycleName)
	}
	out := &ir.LifecycleIR{
		ID:              id("lifecycle", symbolIdentity(context, lifecycleIDName)),
		Name:            lifecycleName,
		OwnerCapability: cap.Name,
		IdentityBinding: lc.Identity,
		Policies:        lifecyclePoliciesIR(cap),
		Initial:         lc.Begin,
		States:          sortedKeys(states),
		Terminal:        sortedStrings(lc.Ends),
	}
	graph := map[string][]string{}
	participants := map[string]bool{cap.Name: true}
	contributors := c.validateLifecycleContributors(lc, context, cap.Name)
	contributorUsage := map[string]*contributorUsage{}
	transitionTargets := map[string]map[string]diagnostic.Span{}
	for _, tr := range lc.Transitions {
		if !states[tr.From] {
			c.diags.Error("DCL_SEM_LIFECYCLE_UNKNOWN_STATE", "transition references unknown source state", tr.Span, tr.From)
		}
		if !states[tr.To] {
			c.diags.Error("DCL_SEM_LIFECYCLE_UNKNOWN_STATE", "transition references unknown target state", tr.Span, tr.To)
		}
		sourceCapability := ""
		sourceSymbol := tr.TriggerName
		correlation := ""
		switch tr.TriggerKind {
		case "outcome":
			if tr.SourceCapability != "" {
				if tr.SourceCapability != cap.Name {
					c.requireLifecycleContributor(tr.SourceCapability, contributors, tr.Span, "transition source")
				}
				sourceCap, ok := c.resolveTransitionSourceCapability(tr.SourceCapability, context, tr.Span)
				if ok {
					sourceCapability = sourceCap.Name
					participants[sourceCap.Name] = true
					if sourceCap.Name != cap.Name {
						recordContributorTransition(contributorUsage, sourceCap.Name, tr.From)
					}
					if !capabilityDeclaresOutcome(sourceCap, tr.TriggerName) {
						c.diags.Error("DCL_SEM_UNDEFINED_TRANSITION_SOURCE_SYMBOL", "transition source capability does not declare outcome", tr.Span, tr.TriggerName)
					}
				}
				correlation = lc.Identity
			} else {
				sourceCapability = cap.Name
				if _, ok := outcomes[tr.TriggerName]; !ok {
					c.diags.Error("DCL_SEM_LIFECYCLE_UNKNOWN_TRIGGER", "lifecycle transition references unknown outcome", tr.Span, tr.TriggerName)
				}
			}
		case "event":
			if tr.SourceCapability != "" {
				if tr.SourceCapability != cap.Name {
					c.requireLifecycleContributor(tr.SourceCapability, contributors, tr.Span, "transition source")
				}
				sourceCap, ok := c.resolveTransitionSourceCapability(tr.SourceCapability, context, tr.Span)
				if ok {
					sourceCapability = sourceCap.Name
					participants[sourceCap.Name] = true
					if sourceCap.Name != cap.Name {
						recordContributorTransition(contributorUsage, sourceCap.Name, tr.From)
					}
					c.validateEventSourceOwnership(sourceCap, tr.TriggerName, tr.Span)
				}
				correlation = lc.Identity
			}
			c.requireInContext("event", tr.TriggerName, context, tr.Span)
		default:
			c.diags.Error("DCL_SEM_LIFECYCLE_TRIGGER_KIND", "lifecycle trigger must be event or outcome", tr.Span, tr.TriggerKind)
		}
		ambiguityKey := lifecycleTransitionAmbiguityKey(tr.From, tr.TriggerKind, sourceCapability, sourceSymbol)
		if transitionTargets[ambiguityKey] == nil {
			transitionTargets[ambiguityKey] = map[string]diagnostic.Span{}
		}
		transitionTargets[ambiguityKey][tr.To] = tr.Span
		graph[tr.From] = append(graph[tr.From], tr.To)
		out.Transitions = append(out.Transitions, ir.TransitionIR{
			From:               tr.From,
			To:                 tr.To,
			TriggerKind:        tr.TriggerKind,
			TriggerName:        tr.TriggerName,
			SourceStep:         tr.From,
			TargetStep:         tr.To,
			SourceKind:         tr.TriggerKind,
			SourceCapability:   sourceCapability,
			SourceSymbol:       sourceSymbol,
			CorrelationBinding: correlation,
		})
	}
	reachable := reachableStates(lc.Begin, graph)
	exits := lifecycleExitCounts(graph)
	recoveryTransitions := recoveryTransitionsBySource(lc.Transitions)
	for _, step := range stepDecls {
		out.Steps = append(out.Steps, c.lifecycleStepIR(cap, step, contributors, contributorUsage, states, reachable, exits, recoveryTransitions, lc.Supervised))
	}
	for _, targets := range transitionTargets {
		if len(targets) <= 1 {
			continue
		}
		var span diagnostic.Span
		var targetNames []string
		for target, targetSpan := range targets {
			if span.Line == 0 {
				span = targetSpan
			}
			targetNames = append(targetNames, target)
		}
		sort.Strings(targetNames)
		c.diags.Error("DCL_SEM_AMBIGUOUS_LIFECYCLE_TRANSITION", "same lifecycle source step and transition trigger lead to multiple target steps", span, strings.Join(targetNames, ", "))
	}
	out.ParticipatingCapabilities = sortedKeys(participants)
	for state := range states {
		if !reachable[state] {
			c.diags.Warning("DCL_SEM_LIFECYCLE_STATE_UNREACHABLE", "lifecycle state is not reachable from the initial state by declared transitions", lc.Span, state)
		}
		if !contains(lc.Ends, state) && len(graph[state]) == 0 {
			c.diags.Warning("DCL_SEM_LIFECYCLE_DEAD_END", "non-terminal lifecycle state has no outgoing transition", lc.Span, state)
		}
	}
	c.validateRecoveryLoops(lc, states, graph)
	c.emitUnusedLifecycleContributorWarnings(contributors, contributorUsage)
	out.Contributors = contributorIR(contributors, contributorUsage)
	sort.Slice(out.Transitions, func(i, j int) bool {
		a, b := out.Transitions[i], out.Transitions[j]
		return a.From+a.To+a.TriggerKind+a.TriggerName+a.SourceCapability < b.From+b.To+b.TriggerKind+b.TriggerName+b.SourceCapability
	})
	sort.Slice(out.Steps, func(i, j int) bool { return out.Steps[i].Name < out.Steps[j].Name })
	return out
}

type contributorUsage struct {
	transitions map[string]bool
	waits       map[string]bool
	recovery    map[string]bool
}

func lifecycleStepDecls(lc *ast.LifecycleDecl) []ast.LifecycleStepDecl {
	byName := map[string]ast.LifecycleStepDecl{}
	var order []string
	add := func(step ast.LifecycleStepDecl) {
		if step.Name == "" {
			return
		}
		existing, exists := byName[step.Name]
		if !exists {
			byName[step.Name] = step
			order = append(order, step.Name)
			return
		}
		if existing.Kind == "" {
			existing.Kind = step.Kind
		}
		if existing.DecisionProvider == "" {
			existing.DecisionProvider = step.DecisionProvider
		}
		existing.Waits = append(existing.Waits, step.Waits...)
		existing.Deadlines = append(existing.Deadlines, step.Deadlines...)
		existing.RecoveryActions = append(existing.RecoveryActions, step.RecoveryActions...)
		existing.IsTerminal = existing.IsTerminal || step.IsTerminal
		byName[step.Name] = existing
	}
	for _, step := range lc.Steps {
		add(step)
	}
	if lc.Begin != "" {
		add(ast.LifecycleStepDecl{Name: lc.Begin, Span: lc.Span})
	}
	for _, end := range lc.Ends {
		add(ast.LifecycleStepDecl{Name: end, IsTerminal: true, Span: lc.Span})
	}
	out := make([]ast.LifecycleStepDecl, 0, len(order))
	for _, name := range order {
		out = append(out, byName[name])
	}
	return out
}

func lifecycleCausedOutcomes(lc *ast.LifecycleDecl) map[string]bool {
	out := map[string]bool{}
	if lc == nil {
		return out
	}
	for _, step := range lifecycleStepDecls(lc) {
		for _, deadline := range step.Deadlines {
			if deadline.ConsequenceKind == "outcome" && deadline.ConsequenceSymbol != "" {
				out[deadline.ConsequenceSymbol] = true
			}
		}
	}
	return out
}

func lifecycleStateSet(steps []ast.LifecycleStepDecl) map[string]bool {
	out := map[string]bool{}
	for _, step := range steps {
		out[step.Name] = true
	}
	return out
}

func (c *compiler) validateLifecycleContributors(lc *ast.LifecycleDecl, context, owner string) map[string]ast.ContributorDecl {
	out := map[string]ast.ContributorDecl{}
	for _, contributor := range lc.Contributors {
		if !lc.Supervised && contributor.Capability == owner {
			c.diags.Warning("DCL_SEM_LIFECYCLE_SELF_CONTRIBUTOR_REDUNDANT", "local lifecycle owner is an implicit contributor", contributor.Span, contributor.Capability)
			continue
		}
		if _, exists := out[contributor.Capability]; exists {
			c.diags.Error("DCL_SEM_LIFECYCLE_CONTRIBUTOR_DUPLICATE", "duplicate lifecycle contributor", contributor.Span, contributor.Capability)
			continue
		}
		out[contributor.Capability] = contributor
		c.requireInContext("capability", contributor.Capability, context, contributor.Span)
	}
	return out
}

func (c *compiler) requireLifecycleContributor(name string, contributors map[string]ast.ContributorDecl, span diagnostic.Span, usage string) bool {
	if name == "" {
		return false
	}
	if _, ok := contributors[name]; ok {
		return true
	}
	c.diags.Error("DCL_SEM_LIFECYCLE_NON_CONTRIBUTOR", usage+" references a capability that is not a declared lifecycle contributor", span, name)
	return false
}

func (c *compiler) lifecycleStepIR(cap ast.CapabilityDecl, step ast.LifecycleStepDecl, contributors map[string]ast.ContributorDecl, usage map[string]*contributorUsage, states map[string]bool, reachable map[string]bool, exits map[string]int, recoveryTransitions map[string][]ast.TransitionDecl, supervised bool) ir.LifecycleStepIR {
	context := declContext(cap.Meta.ContextName)
	kind := step.Kind
	if step.DecisionProvider != "" {
		if kind != "" && kind != lifecycleKindDecision {
			c.diags.Error("DCL_SEM_LIFECYCLE_STEP_ROLE_CONFLICT", "decision requirement conflicts with lifecycle step kind", step.Span, step.Name)
		}
		kind = lifecycleKindDecision
	}
	if len(step.Waits) > 0 {
		if kind != "" && kind != lifecycleKindWaiting {
			c.diags.Error("DCL_SEM_LIFECYCLE_STEP_ROLE_CONFLICT", "wait condition conflicts with lifecycle step kind", step.Span, step.Name)
		}
		kind = lifecycleKindWaiting
	}
	if step.IsTerminal {
		if kind != "" && kind != lifecycleKindTerminal {
			c.diags.Error("DCL_SEM_LIFECYCLE_TERMINAL_KIND_CONFLICT", "terminal lifecycle step must not declare a non-terminal kind", step.Span, step.Name)
		}
		kind = lifecycleKindTerminal
	}
	if kind != "" && !validLifecycleStepKind(kind) {
		c.diags.Error("DCL_SEM_LIFECYCLE_STEP_KIND_INVALID", "invalid lifecycle step kind", step.Span, kind)
	}
	if step.Kind == lifecycleKindWaiting && len(step.Waits) == 0 {
		c.diags.Error("DCL_SEM_LIFECYCLE_WAIT_MISSING", "waiting lifecycle step must declare at least one wait condition", step.Span, step.Name)
	}
	if step.Kind == lifecycleKindWaiting && exits[step.Name] == 0 {
		c.diags.Error("DCL_SEM_LIFECYCLE_WAIT_NO_EXIT", "waiting lifecycle step must have at least one exit transition", step.Span, step.Name)
	}
	if step.Kind == lifecycleKindWaiting && !reachable[step.Name] {
		c.diags.Warning("DCL_SEM_LIFECYCLE_STATE_UNREACHABLE", "waiting lifecycle step is not reachable", step.Span, step.Name)
	}
	out := ir.LifecycleStepIR{Name: step.Name, Kind: kind, IsTerminal: step.IsTerminal}
	if step.DecisionProvider != "" {
		out.DecisionActor, out.DecisionRole = c.resolveDecisionProvider(cap, step)
	}
	for _, wait := range step.Waits {
		out.WaitingTriggers = append(out.WaitingTriggers, c.waitTriggerIR(cap, step.Name, wait, contributors, usage, context, supervised))
	}
	for _, deadline := range step.Deadlines {
		out.Deadlines = append(out.Deadlines, c.deadlineIR(step.Name, deadline, cap))
	}
	if len(step.Deadlines) > 1 {
		c.diags.Error("DCL_SEM_LIFECYCLE_DEADLINE_CONFLICT", "lifecycle step declares conflicting deadlines", step.Span, step.Name)
	}
	for _, recovery := range step.RecoveryActions {
		out.RecoveryActions = append(out.RecoveryActions, c.recoveryIR(step.Name, recovery, contributors, usage, states, recoveryTransitions, context))
	}
	return out
}

func (c *compiler) waitTriggerIR(cap ast.CapabilityDecl, stepName string, wait ast.WaitTriggerDecl, contributors map[string]ast.ContributorDecl, usage map[string]*contributorUsage, context string, supervised bool) ir.WaitTriggerIR {
	sourceCapability := wait.SourceCapability
	if sourceCapability == "" {
		if supervised {
			c.diags.Error("DCL_SEM_LIFECYCLE_WAIT_SOURCE_REQUIRED", "supervised lifecycle wait condition must declare a source capability", wait.Span, wait.SignalName)
		} else {
			sourceCapability = cap.Name
		}
	}
	if sourceCapability == "" {
		return ir.WaitTriggerIR{SignalKind: wait.SignalKind, SignalName: wait.SignalName}
	}
	if sourceCapability != cap.Name {
		c.requireLifecycleContributor(sourceCapability, contributors, wait.Span, "wait condition")
		recordContributorWait(usage, sourceCapability, stepName)
	}
	switch wait.SignalKind {
	case "outcome":
		sourceCap, ok := c.resolveTransitionSourceCapability(sourceCapability, context, wait.Span)
		if ok && !capabilityDeclaresOutcome(sourceCap, wait.SignalName) {
			c.diags.Error("DCL_SEM_LIFECYCLE_WAIT_SIGNAL_UNKNOWN", "wait condition references an outcome not declared by the source capability", wait.Span, wait.SignalName)
		}
	case "event":
		if _, ok := c.resolve("event", wait.SignalName, context, wait.Span, true); ok {
			sourceCap, capOK := c.resolveTransitionSourceCapability(sourceCapability, context, wait.Span)
			if capOK && !capabilityEmitsEvent(sourceCap, wait.SignalName) {
				// Keep this as a warning: event existence is proven, but ownership declarations can be
				// intentionally incomplete during staged authoring and should not block compilation.
				c.diags.Warning("DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED", "event exists, but capability event emission ownership cannot be fully verified yet", wait.Span, sourceCapability+"."+wait.SignalName)
				c.diags.Warning("DCL_SEM_LIFECYCLE_EVENT_SOURCE_UNDECLARED", "event source capability does not declare emitted event ownership", wait.Span, sourceCapability+"."+wait.SignalName)
			}
		}
	default:
		c.diags.Error("DCL_SEM_LIFECYCLE_WAIT_SIGNAL_KIND", "wait condition signal kind must be event or outcome", wait.Span, wait.SignalKind)
	}
	return ir.WaitTriggerIR{SignalKind: wait.SignalKind, SignalName: wait.SignalName, SourceCapability: sourceCapability}
}

func (c *compiler) deadlineIR(step string, deadline ast.DeadlineDecl, cap ast.CapabilityDecl) ir.DeadlineIR {
	if !positiveDuration(deadline.Duration) {
		c.diags.Error("DCL_SEM_LIFECYCLE_DEADLINE_DURATION_INVALID", "deadline duration must be positive", deadline.Span, strings.Join(deadline.Duration, " "))
	}
	if deadline.ConsequenceKind != "outcome" {
		c.diags.Error("DCL_SEM_LIFECYCLE_DEADLINE_CONSEQUENCE_KIND", "deadline consequence must be outcome", deadline.Span, deadline.ConsequenceKind)
	} else if !capabilityDeclaresOutcome(cap, deadline.ConsequenceSymbol) {
		c.diags.Error("DCL_SEM_LIFECYCLE_DEADLINE_CONSEQUENCE_UNKNOWN", "deadline consequence references unknown outcome", deadline.Span, deadline.ConsequenceSymbol)
	}
	return ir.DeadlineIR{
		Step:              step,
		Duration:          strings.Join(deadline.Duration, " "),
		ConsequenceKind:   deadline.ConsequenceKind,
		ConsequenceSymbol: deadline.ConsequenceSymbol,
	}
}

func (c *compiler) recoveryIR(stepName string, recovery ast.RecoveryDecl, contributors map[string]ast.ContributorDecl, usage map[string]*contributorUsage, states map[string]bool, recoveryTransitions map[string][]ast.TransitionDecl, context string) ir.RecoveryIR {
	targetKind, ok := c.resolveRecoveryTarget(recovery.Target, context, recovery.Span)
	if ok && targetKind == "capability" {
		c.requireLifecycleContributor(recovery.Target, contributors, recovery.Span, "recovery target")
		recordContributorRecovery(usage, recovery.Target, stepName)
	}
	resultTransitions := recoveryTransitions[recovery.Target]
	if len(resultTransitions) == 0 {
		c.diags.Error("DCL_SEM_LIFECYCLE_RECOVERY_RESULT_TRANSITION_MISSING", "recovery declaration requires an explicit lifecycle transition sourced from the recovery target", recovery.Span, recovery.Target)
	}
	var resultOutcomes []string
	for _, tr := range resultTransitions {
		if tr.TriggerKind == "outcome" {
			resultOutcomes = append(resultOutcomes, tr.TriggerName)
		}
		if !states[tr.From] || !states[tr.To] {
			c.diags.Error("DCL_SEM_LIFECYCLE_RECOVERY_TARGET_UNREACHABLE", "recovery target transition references unknown lifecycle state", tr.Span, recovery.Target)
		}
	}
	return ir.RecoveryIR{DeclaringStep: stepName, Target: recovery.Target, TargetKind: targetKind, ResultOutcomes: sortedStrings(resultOutcomes)}
}

func (c *compiler) resolveRecoveryTarget(name, context string, span diagnostic.Span) (string, bool) {
	_, capOK := c.resolve("capability", name, context, span, false)
	_, effectOK := c.resolve("effect", name, context, span, false)
	if capOK && effectOK {
		c.diags.Error("DCL_SEM_LIFECYCLE_RECOVERY_TARGET_AMBIGUOUS", "recovery target matches both capability and effect", span, name)
		return "", false
	}
	if capOK {
		return "capability", true
	}
	if effectOK {
		return "effect", true
	}
	c.diags.Error("DCL_SEM_LIFECYCLE_RECOVERY_TARGET_UNKNOWN", "recovery target does not exist", span, name)
	return "", false
}

func (c *compiler) resolveDecisionProvider(cap ast.CapabilityDecl, step ast.LifecycleStepDecl) (string, string) {
	context := declContext(cap.Meta.ContextName)
	var roleActor string
	roleFound := false
	for _, role := range cap.Actors {
		if role.Role == step.DecisionProvider {
			roleActor = role.Actor
			roleFound = true
			break
		}
	}
	_, actorFound := c.resolve("actor", step.DecisionProvider, context, step.Span, false)
	if roleFound && actorFound {
		c.diags.Error("DCL_SEM_LIFECYCLE_DECISION_PROVIDER_AMBIGUOUS", "decision provider matches both a capability actor role and an actor symbol", step.Span, step.DecisionProvider)
		return "", ""
	}
	if roleFound {
		c.requireInContext("actor", roleActor, context, step.Span)
		return roleActor, step.DecisionProvider
	}
	if actorFound {
		return step.DecisionProvider, ""
	}
	c.diags.Error("DCL_SEM_LIFECYCLE_DECISION_PROVIDER_UNKNOWN", "decision provider must be a capability actor role or actor", step.Span, step.DecisionProvider)
	return "", ""
}

func lifecycleExitCounts(graph map[string][]string) map[string]int {
	out := map[string]int{}
	for from, targets := range graph {
		out[from] = len(targets)
	}
	return out
}

func recoveryTransitionsBySource(transitions []ast.TransitionDecl) map[string][]ast.TransitionDecl {
	out := map[string][]ast.TransitionDecl{}
	for _, tr := range transitions {
		if tr.SourceCapability != "" {
			out[tr.SourceCapability] = append(out[tr.SourceCapability], tr)
		}
	}
	return out
}

func validLifecycleStepKind(kind string) bool {
	switch kind {
	case lifecycleKindActive, lifecycleKindWaiting, lifecycleKindDecision, lifecycleKindRecovery, lifecycleKindTerminal:
		return true
	default:
		return false
	}
}

func recordContributorTransition(usage map[string]*contributorUsage, capability, step string) {
	item := ensureContributorUsage(usage, capability)
	item.transitions[step] = true
}

func recordContributorWait(usage map[string]*contributorUsage, capability, step string) {
	item := ensureContributorUsage(usage, capability)
	item.waits[step] = true
}

func recordContributorRecovery(usage map[string]*contributorUsage, capability, step string) {
	item := ensureContributorUsage(usage, capability)
	item.recovery[step] = true
}

func ensureContributorUsage(usage map[string]*contributorUsage, capability string) *contributorUsage {
	if usage[capability] == nil {
		usage[capability] = &contributorUsage{transitions: map[string]bool{}, waits: map[string]bool{}, recovery: map[string]bool{}}
	}
	return usage[capability]
}

func contributorIR(contributors map[string]ast.ContributorDecl, usage map[string]*contributorUsage) []ir.ContributorIR {
	var out []ir.ContributorIR
	for capability := range contributors {
		item := usage[capability]
		contributor := ir.ContributorIR{Capability: capability}
		if item != nil {
			contributor.UsedByTransitions = sortedBoolKeys(item.transitions)
			contributor.UsedByWaitingSteps = sortedBoolKeys(item.waits)
			contributor.UsedByRecovery = sortedBoolKeys(item.recovery)
		}
		out = append(out, contributor)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Capability < out[j].Capability })
	return out
}

func (c *compiler) emitUnusedLifecycleContributorWarnings(contributors map[string]ast.ContributorDecl, usage map[string]*contributorUsage) {
	for capability, decl := range contributors {
		item := usage[capability]
		if item == nil || (len(item.transitions) == 0 && len(item.waits) == 0 && len(item.recovery) == 0) {
			c.diags.Warning("DCL_SEM_LIFECYCLE_CONTRIBUTOR_UNUSED", "lifecycle contributor is not used by transitions, waiting steps, or recovery", decl.Span, capability)
		}
	}
}

func (c *compiler) validateRecoveryLoops(lc *ast.LifecycleDecl, states map[string]bool, graph map[string][]string) {
	terminal := setFrom(lc.Ends)
	canReachTerminal := map[string]bool{}
	var reachesTerminal func(string, map[string]bool) bool
	reachesTerminal = func(state string, visiting map[string]bool) bool {
		if terminal[state] {
			return true
		}
		if value, ok := canReachTerminal[state]; ok {
			return value
		}
		if visiting[state] {
			return false
		}
		visiting[state] = true
		for _, next := range graph[state] {
			if reachesTerminal(next, visiting) {
				canReachTerminal[state] = true
				visiting[state] = false
				return true
			}
		}
		visiting[state] = false
		canReachTerminal[state] = false
		return false
	}
	for state := range states {
		if !terminal[state] && len(graph[state]) > 0 && !reachesTerminal(state, map[string]bool{}) {
			c.diags.Error("DCL_SEM_LIFECYCLE_RECOVERY_LOOP_INVALID", "lifecycle path cannot reach a terminal state", lc.Span, state)
		}
	}
}

func lifecycleIRName(cap ast.CapabilityDecl) string {
	if cap.Lifecycle == nil || cap.Lifecycle.Name == "" {
		return cap.Name
	}
	return cap.Lifecycle.Name
}

func (c *compiler) validateLifecycleOwnership(cap ast.CapabilityDecl) {
	if cap.Lifecycle == nil || cap.Lifecycle.Name == "" {
		return
	}
	key := symbolIdentity(cap.Meta.ContextName, cap.Lifecycle.Name)
	if owner, exists := c.lifecycleOwners[key]; exists {
		c.diags.Error("DCL_SEM_LIFECYCLE_MULTIPLE_OWNERS", "supervised lifecycle has multiple owning capabilities", cap.Lifecycle.Span, cap.Lifecycle.Name)
		c.diags.Error("DCL_SEM_LIFECYCLE_MULTIPLE_OWNERS", "supervised lifecycle has multiple owning capabilities", owner.Lifecycle.Span, cap.Lifecycle.Name)
		return
	}
	c.lifecycleOwners[key] = cap
}

func lifecyclePoliciesIR(cap ast.CapabilityDecl) []ir.PolicyUseIR {
	var out []ir.PolicyUseIR
	for _, policy := range cap.Policies {
		if policy.TargetKind == targetLifecycle {
			out = append(out, ir.PolicyUseIR{Policy: policy.Name, TargetKind: policy.TargetKind, TargetName: policyTargetName(cap, policy)})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Policy < out[j].Policy })
	return out
}

func (c *compiler) resolveTransitionSourceCapability(name, context string, span diagnostic.Span) (ast.CapabilityDecl, bool) {
	info, ok := c.resolve("capability", name, context, span, false)
	if !ok {
		c.diags.Error("DCL_SEM_UNDEFINED_TRANSITION_SOURCE_CAPABILITY", "transition references undefined source capability", span, name)
		return ast.CapabilityDecl{}, false
	}
	cap, ok := c.capabilities[symbolIdentity(info.Context, info.Name)]
	if !ok {
		c.diags.Error("DCL_SEM_UNDEFINED_TRANSITION_SOURCE_CAPABILITY", "transition references undefined source capability", span, name)
		return ast.CapabilityDecl{}, false
	}
	return cap, true
}

func capabilityDeclaresOutcome(cap ast.CapabilityDecl, name string) bool {
	for _, outcome := range cap.Outcomes {
		if outcome.Name == name {
			return true
		}
	}
	return false
}

func capabilityEmitsEvent(cap ast.CapabilityDecl, name string) bool {
	for _, event := range cap.Events {
		if event.Name == name {
			return true
		}
	}
	return false
}

func validateDuplicateEmittedEvents(diags *diagnostic.Bag, events []ast.EventEmissionDecl) {
	seen := map[string]diagnostic.Span{}
	for _, event := range events {
		if old, exists := seen[event.Name]; exists {
			diags.Error("DCL_SEM_CAPABILITY_EVENT_DUPLICATE", fmt.Sprintf("duplicate emitted event; first declared at %s:%d:%d", old.File, old.Line, old.Column), event.Span, event.Name)
			continue
		}
		seen[event.Name] = event.Span
	}
}

func (c *compiler) validateEventSourceOwnership(sourceCap ast.CapabilityDecl, eventName string, span diagnostic.Span) {
	if !capabilityEmitsEvent(sourceCap, eventName) {
		c.diags.Warning("DCL_SEM_LIFECYCLE_EVENT_SOURCE_UNDECLARED", "event source capability does not declare emitted event ownership", span, sourceCap.Name+"."+eventName)
	}
}

func lifecycleTransitionAmbiguityKey(sourceStep, sourceKind, sourceCapability, sourceSymbol string) string {
	// Ambiguity is defined by "same source state + same trigger identity" regardless of target state.
	return sourceStep + "\x00" + sourceKind + "\x00" + sourceCapability + "\x00" + sourceSymbol
}

func (c *compiler) validatePolicyTarget(cap ast.CapabilityDecl, policy ast.PolicyUse, outcomes map[string]ast.OutcomeDecl, effects map[string]ast.EffectUse) {
	context := declContext(cap.Meta.ContextName)
	switch policy.TargetKind {
	case targetCapability:
		if policy.TargetName == "" {
			return
		}
		if policy.TargetName != cap.Name {
			c.diags.Error("DCL_SEM_POLICY_TARGET_UNKNOWN", "policy target capability is not the current capability", policy.Span, policy.TargetName)
		}
	case targetEffect:
		if _, ok := effects[policy.TargetName]; !ok {
			c.diags.Error("DCL_SEM_POLICY_TARGET_UNKNOWN", "policy target effect is not used by this capability", policy.Span, policy.TargetName)
		}
	case targetOutcome:
		if _, ok := outcomes[policy.TargetName]; !ok {
			c.diags.Error("DCL_SEM_POLICY_TARGET_UNKNOWN", "policy target outcome is not declared by this capability", policy.Span, policy.TargetName)
		}
	case targetEvent:
		if _, ok := c.resolve("event", policy.TargetName, context, policy.Span, false); !ok {
			c.diags.Error("DCL_SEM_POLICY_TARGET_UNKNOWN", "policy target event is not declared", policy.Span, policy.TargetName)
		}
	case targetLifecycle:
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
	context := declContext(cap.Meta.ContextName)
	switch observation.TargetKind {
	case targetCapability:
		if observation.TargetName != "" && observation.TargetName != cap.Name {
			c.diags.Error("DCL_SEM_OBSERVE_TARGET_UNKNOWN", "observation target capability is not the current capability", observation.Span, observation.TargetName)
		}
		return id(targetCapability, symbolIdentity(context, cap.Name))
	case targetEffect:
		if _, ok := effects[observation.TargetName]; !ok {
			c.diags.Error("DCL_SEM_OBSERVE_TARGET_UNKNOWN", "observation target effect is not used by this capability", observation.Span, observation.TargetName)
		}
		return id(targetEffect, observation.TargetName)
	case targetOutcome:
		if _, ok := outcomes[observation.TargetName]; !ok {
			c.diags.Error("DCL_SEM_OBSERVE_TARGET_UNKNOWN", "observation target outcome is not declared by this capability", observation.Span, observation.TargetName)
		}
		return id(targetOutcome, symbolIdentity(context, cap.Name+"."+observation.TargetName))
	case targetEvent:
		if _, ok := c.resolve("event", observation.TargetName, context, observation.Span, false); !ok {
			c.diags.Error("DCL_SEM_OBSERVE_TARGET_UNKNOWN", "observation target event is not declared", observation.Span, observation.TargetName)
		}
		return id(targetEvent, observation.TargetName)
	case targetLifecycle:
		if cap.Lifecycle == nil {
			c.diags.Error("DCL_SEM_OBSERVE_TARGET_UNKNOWN", "observation target lifecycle is not declared by this capability", observation.Span, cap.Name)
		}
		return id(targetLifecycle, symbolIdentity(context, cap.Name))
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

func (c *compiler) validateFields(fields []ast.Field, context string) {
	for _, field := range fields {
		c.validateType(field.Type, context, field.Span)
	}
}

func (c *compiler) validatePayload(payload ast.Payload, context string) {
	if payload.NamedType != "" {
		c.validateType(payload.NamedType, context, diagnostic.Span{})
	}
	c.validateFields(payload.Fields, context)
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
	policy, ok := c.resolvePolicyUse(cap, use)
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
			if use.TargetKind != targetEffect {
				c.diags.Error("DCL_SEM_POLICY_CONCERN_ATTACHMENT_INVALID", "circuit_breaker may only govern effects", use.Span, use.Name)
			}
		}
	}
}

func (c *compiler) recordPolicyAttachment(cap ast.CapabilityDecl, use ast.PolicyUse) {
	policy, ok := c.resolvePolicyUse(cap, use)
	if !ok {
		return
	}
	c.policyAttachments[policyKey(policy.Meta.ContextName, policy.Name)] = append(c.policyAttachments[policyKey(policy.Meta.ContextName, policy.Name)], ir.PolicyAttachmentIR{
		Capability: cap.Name,
		TargetKind: use.TargetKind,
		TargetName: policyTargetName(cap, use),
	})
}

func (c *compiler) policyIR(policy ast.PolicyDecl) ir.PolicyIR {
	out := ir.PolicyIR{ID: id("policy", symbolIdentity(policy.Meta.ContextName, policy.Name)), Name: policy.Name, Family: policy.Family, Concern: policy.Concern}
	for _, concern := range policy.Concerns {
		out.Concerns = append(out.Concerns, concernIR(policy.Family, concern))
		if objective := objectiveIR(concern); objective.Concern != "" {
			out.Objectives = append(out.Objectives, objective)
		}
		out.DerivedObligations = append(out.DerivedObligations, obligationIR(concern, "", ""))
	}
	return out
}

func (c *compiler) resolvePolicyUse(cap ast.CapabilityDecl, use ast.PolicyUse) (ast.PolicyDecl, bool) {
	info, ok := c.resolve("policy", use.Name, declContext(cap.Meta.ContextName), use.Span, false)
	if !ok {
		return ast.PolicyDecl{}, false
	}
	policy, ok := c.policies[policyKey(info.Context, info.Name)]
	return policy, ok
}

func (c *compiler) applyPolicyAttachments(out *ir.ProgramIR) {
	for i := range out.Policies {
		attachments := append([]ir.PolicyAttachmentIR(nil), c.policyAttachments[strings.TrimPrefix(out.Policies[i].ID, "policy:")]...)
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

func (c *compiler) validateType(name string, context string, span diagnostic.Span) {
	if name == "" || isBuiltinType(name) || strings.HasPrefix(name, "List<") {
		if strings.HasPrefix(name, "List<") {
			inner := strings.TrimSuffix(strings.TrimPrefix(name, "List<"), ">")
			c.validateType(inner, context, span)
		}
		return
	}
	if declContext(context) == "default" {
		if _, ok := c.resolve("shape", name, context, span, false); !ok {
			return
		}
	}
	c.requireInContext("shape", name, context, span)
}

func (c *compiler) indexContexts() {
	c.ensureContext("default", diagnostic.Span{})
	for _, ctx := range c.program.Contexts {
		c.ensureContext(ctx.Name, ctx.Span)
		if ctx.Parent != "" {
			c.ensureContext(ctx.Parent, ctx.Span)
		}
		if info := c.contexts[ctx.Name]; info != nil && info.Parent == "" {
			info.Parent = ctx.Parent
		}
	}
	for _, dep := range c.program.Dependencies {
		c.ensureContext(dep.SourceContext, dep.Span)
		if c.dependencies[dep.SourceContext] == nil {
			c.dependencies[dep.SourceContext] = map[string]diagnostic.Span{}
		}
		c.dependencies[dep.SourceContext][dep.TargetContext] = dep.Span
	}
}

func (c *compiler) ensureContext(name string, span diagnostic.Span) {
	if name == "" {
		name = "default"
	}
	if _, exists := c.contexts[name]; exists {
		return
	}
	c.contexts[name] = &contextInfo{Name: name, Parent: parentName(name), Span: span}
}

func (c *compiler) indexSymbols() {
	owners := map[string]string{}
	add := func(kind, name, context, visibility string, span diagnostic.Span) {
		if context == "" {
			context = "default"
		}
		if visibility == "" {
			visibility = "public"
		}
		ownerKey := fmt.Sprintf("%s:%s:%s:%d:%d", kind, name, span.File, span.Line, span.Column)
		if oldContext, exists := owners[ownerKey]; exists && oldContext != context {
			c.diags.Error("DCL_SEM_DUPLICATE_CONTEXT_OWNERSHIP", "declaration belongs to multiple contexts", span, name)
			return
		}
		owners[ownerKey] = context
		c.ensureContext(context, span)
		if c.symbolsByContext[context] == nil {
			c.symbolsByContext[context] = map[string]map[string]*symbolInfo{}
		}
		if c.symbolsByContext[context][kind] == nil {
			c.symbolsByContext[context][kind] = map[string]*symbolInfo{}
		}
		if old, exists := c.symbolsByContext[context][kind][name]; exists {
			c.diags.Error("DCL_SEM_DUPLICATE_SYMBOL", fmt.Sprintf("duplicate %s %s; first declared at %s:%d:%d", kind, name, old.Span.File, old.Span.Line, old.Span.Column), span, name)
			return
		}
		info := &symbolInfo{Kind: kind, Name: name, Context: context, Visibility: visibility, FQN: qualify(context, name), Span: span}
		c.symbolsByContext[context][kind][name] = info
		if c.symbolsByFQN[kind] == nil {
			c.symbolsByFQN[kind] = map[string]*symbolInfo{}
		}
		c.symbolsByFQN[kind][info.FQN] = info
		if c.symbolsByKindName[kind] == nil {
			c.symbolsByKindName[kind] = map[string][]*symbolInfo{}
		}
		c.symbolsByKindName[kind][name] = append(c.symbolsByKindName[kind][name], info)
	}
	for _, item := range c.program.Shapes {
		add("shape", item.Name, item.Meta.ContextName, item.Meta.Visibility, item.Span)
	}
	for _, item := range c.program.Actors {
		add("actor", item.Name, item.Meta.ContextName, item.Meta.Visibility, item.Span)
	}
	for _, item := range c.program.Events {
		add("event", item.Name, item.Meta.ContextName, item.Meta.Visibility, item.Span)
	}
	for _, item := range c.program.Effects {
		add("effect", item.Name, item.Meta.ContextName, item.Meta.Visibility, item.Span)
	}
	for _, item := range c.program.Policies {
		add("policy", item.Name, item.Meta.ContextName, item.Meta.Visibility, item.Span)
	}
	for _, item := range c.program.Capabilities {
		add("capability", item.Name, item.Meta.ContextName, item.Meta.Visibility, item.Span)
	}
}

func (c *compiler) validateDependencies() {
	for source, targets := range c.dependencies {
		for target, span := range targets {
			if _, ok := c.contexts[target]; !ok {
				c.diags.Error("DCL_SEM_UNDEFINED_CONTEXT", "undefined context", span, target)
			}
			if target == source {
				c.diags.Error("DCL_SEM_DEPENDENCY_CYCLE", "context dependency cycle", span, source)
			}
		}
	}
	c.detectDependencyCycles()
}

func (c *compiler) detectDependencyCycles() {
	visiting := map[string]bool{}
	visited := map[string]bool{}
	var visit func(string, []string)
	visit = func(ctx string, path []string) {
		if visiting[ctx] {
			c.diags.Error("DCL_SEM_DEPENDENCY_CYCLE", "context dependency cycle", c.contexts[ctx].Span, strings.Join(append(path, ctx), " -> "))
			return
		}
		if visited[ctx] {
			return
		}
		visiting[ctx] = true
		for target := range c.dependencies[ctx] {
			if _, ok := c.contexts[target]; ok {
				visit(target, append(path, ctx))
			}
		}
		visiting[ctx] = false
		visited[ctx] = true
	}
	for ctx := range c.contexts {
		visit(ctx, nil)
	}
}

func (c *compiler) hasGlobal(kind, name string) bool {
	_, ok := c.resolve(kind, name, "default", diagnostic.Span{}, false)
	return ok
}

func (c *compiler) requireGlobal(kind, name string, span diagnostic.Span) {
	c.requireInContext(kind, name, "default", span)
}

func (c *compiler) requireInContext(kind, name, context string, span diagnostic.Span) *symbolInfo {
	info, ok := c.resolve(kind, name, context, span, true)
	if !ok {
		return nil
	}
	return info
}

func (c *compiler) resolve(kind, name, context string, span diagnostic.Span, report bool) (*symbolInfo, bool) {
	if name == "" {
		return nil, false
	}
	if context == "" {
		context = "default"
	}
	if info := c.symbolsByFQN[kind][name]; info != nil {
		resolved, dependencyTarget, ok := c.checkResolvedAccess(info, context, span, report)
		if ok {
			c.recordDependencyReference(context, dependencyTarget, resolved.FQN)
		}
		return resolved, ok
	}
	if info := c.symbolsByContext[context][kind][name]; info != nil {
		return info, true
	}
	var matches []*symbolInfo
	privateSeen := false
	for target := range c.dependencies[context] {
		info := c.symbolsByContext[target][kind][name]
		if info == nil {
			continue
		}
		if info.Visibility == "private" {
			privateSeen = true
			continue
		}
		matches = append(matches, info)
	}
	if len(matches) == 1 {
		c.recordDependencyReference(context, matches[0].Context, matches[0].FQN)
		return matches[0], true
	}
	if len(matches) > 1 {
		if report {
			c.diags.Error("DCL_SEM_AMBIGUOUS_SYMBOL", "ambiguous symbol", span, name)
		}
		return nil, false
	}
	if privateSeen && report {
		c.diags.Error("DCL_SEM_SYMBOL_IS_PRIVATE", "symbol is private", span, name)
		return nil, false
	}
	if report {
		c.diags.Error(undefinedSymbolCode(kind, context), "undefined "+kind, span, name)
	}
	return nil, false
}

func (c *compiler) checkResolvedAccess(info *symbolInfo, context string, span diagnostic.Span, report bool) (*symbolInfo, string, bool) {
	if info.Context == context {
		return info, "", true
	}
	if _, ok := c.dependencies[context][info.Context]; !ok {
		if report {
			c.diags.Error(undefinedSymbolCode(info.Kind, context), "undefined "+info.Kind, span, info.FQN)
		}
		return nil, "", false
	}
	if info.Visibility == "private" {
		if report {
			c.diags.Error("DCL_SEM_SYMBOL_IS_PRIVATE", "symbol is private", span, info.FQN)
		}
		return nil, "", false
	}
	return info, info.Context, true
}

func (c *compiler) recordDependencyReference(source, target, symbol string) {
	if source == "" || target == "" || source == target || symbol == "" {
		return
	}
	if c.referencedDeps[source] == nil {
		c.referencedDeps[source] = map[string]map[string]bool{}
	}
	if c.referencedDeps[source][target] == nil {
		c.referencedDeps[source][target] = map[string]bool{}
	}
	c.referencedDeps[source][target][symbol] = true
}

func mergeProgram(dst *ast.Program, src *ast.Program) {
	if src == nil {
		return
	}
	dst.Languages = append(dst.Languages, src.Languages...)
	dst.Contexts = append(dst.Contexts, src.Contexts...)
	dst.Dependencies = append(dst.Dependencies, src.Dependencies...)
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

func (c *compiler) symbolIR(kind, name, context string, span diagnostic.Span) ir.SymbolIR {
	context = declContext(context)
	info := c.symbolsByContext[context][kind][name]
	visibility := "public"
	fqn := symbolIdentity(context, name)
	if info != nil {
		visibility = info.Visibility
		fqn = info.FQN
	}
	return ir.SymbolIR{
		ID:                 id(kind, fqn),
		Name:               name,
		FullyQualifiedName: fqn,
		Kind:               kind,
		Context:            context,
		Visibility:         visibility,
		Declared:           fmt.Sprintf("%s:%d:%d", filepath.ToSlash(span.File), span.Line, span.Column),
	}
}

func (c *compiler) contextIR() []ir.ContextIR {
	declarations := map[string][]string{}
	publicSymbols := map[string][]string{}
	for _, byKind := range c.symbolsByContext {
		for _, byName := range byKind {
			for _, sym := range byName {
				declarations[sym.Context] = append(declarations[sym.Context], sym.FQN)
				if sym.Visibility == "public" {
					publicSymbols[sym.Context] = append(publicSymbols[sym.Context], sym.FQN)
				}
			}
		}
	}
	children := map[string][]string{}
	for _, ctx := range c.contexts {
		if ctx.Parent != "" {
			children[ctx.Parent] = append(children[ctx.Parent], ctx.Name)
		}
	}
	var out []ir.ContextIR
	for _, ctx := range c.contexts {
		deps := sortedDependencyTargets(c.dependencies[ctx.Name])
		out = append(out, ir.ContextIR{
			ID:            id("context", ctx.Name),
			Name:          ctx.Name,
			Parent:        ctx.Parent,
			Children:      sortedStrings(children[ctx.Name]),
			Declarations:  sortedStrings(declarations[ctx.Name]),
			PublicSymbols: sortedStrings(publicSymbols[ctx.Name]),
			Dependencies:  deps,
		})
	}
	return out
}

func (c *compiler) dependencyIR() []ir.DependencyIR {
	var out []ir.DependencyIR
	for source, targets := range c.dependencies {
		for target := range targets {
			refs := sortedBoolKeys(c.referencedDeps[source][target])
			out = append(out, ir.DependencyIR{SourceContext: source, TargetContext: target, ReferencedSymbols: refs})
		}
	}
	return out
}

func (c *compiler) emitUnusedDependencyWarnings() {
	for source, targets := range c.dependencies {
		for target, span := range targets {
			if len(c.referencedDeps[source][target]) == 0 {
				c.diags.Warning("DCL_SEM_UNUSED_DEPENDENCY", "unused dependency", span, target)
			}
		}
	}
}

func declContext(context string) string {
	if context == "" {
		return "default"
	}
	return context
}

func symbolIdentity(context, name string) string {
	context = declContext(context)
	if context == "default" {
		return name
	}
	return context + "." + name
}

func qualify(context, name string) string {
	return symbolIdentity(context, name)
}

func policyKey(context, name string) string {
	return symbolIdentity(context, name)
}

func undefinedSymbolCode(kind, context string) string {
	if declContext(context) == "default" {
		return "DCL_SEM_UNKNOWN_" + strings.ToUpper(kind)
	}
	return "DCL_SEM_UNDEFINED_SYMBOL"
}

func parentName(name string) string {
	idx := strings.LastIndex(name, ".")
	if idx <= 0 {
		return ""
	}
	return name[:idx]
}

func sortedDependencyTargets(items map[string]diagnostic.Span) []string {
	out := make([]string, 0, len(items))
	for item := range items {
		out = append(out, item)
	}
	sort.Strings(out)
	return out
}

func sortedBoolKeys(items map[string]bool) []string {
	out := make([]string, 0, len(items))
	for item := range items {
		out = append(out, item)
	}
	sort.Strings(out)
	return out
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

func (c *compiler) normalizedEffectKind(effect ast.EffectDecl) string {
	switch effect.Kind {
	case "notify":
		c.diags.Warning("DCL_SEM_EFFECT_KIND_LEGACY", "legacy effect kind should use notification", effect.Span, effect.Kind)
		return "notification"
	case "persist":
		c.diags.Warning("DCL_SEM_EFFECT_KIND_LEGACY", "legacy effect kind should use persistence", effect.Span, effect.Kind)
		return "persistence"
	case "invoke":
		c.diags.Warning("DCL_SEM_EFFECT_KIND_LEGACY", "legacy effect kind should use invocation", effect.Span, effect.Kind)
		return "invocation"
	default:
		return effect.Kind
	}
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
	case targetCapability, targetLifecycle:
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

func compareVersion(a, b string) int {
	aParts := strings.Split(a, ".")
	bParts := strings.Split(b, ".")
	max := len(aParts)
	if len(bParts) > max {
		max = len(bParts)
	}
	for i := 0; i < max; i++ {
		aNum := versionPart(aParts, i)
		bNum := versionPart(bParts, i)
		if aNum > bNum {
			return 1
		}
		if aNum < bNum {
			return -1
		}
	}
	return 0
}

func versionPart(parts []string, i int) int {
	if i >= len(parts) {
		return 0
	}
	n, err := strconv.Atoi(parts[i])
	if err != nil {
		return 0
	}
	return n
}

func sortProgramIR(out *ir.ProgramIR) {
	sort.Slice(out.Contexts, func(i, j int) bool { return out.Contexts[i].Name < out.Contexts[j].Name })
	sort.Slice(out.Dependencies, func(i, j int) bool {
		a, b := out.Dependencies[i], out.Dependencies[j]
		return a.SourceContext+a.TargetContext < b.SourceContext+b.TargetContext
	})
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
	sort.Slice(out.EmittedEvents, func(i, j int) bool {
		return out.EmittedEvents[i].Source+out.EmittedEvents[i].Event < out.EmittedEvents[j].Source+out.EmittedEvents[j].Event
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
