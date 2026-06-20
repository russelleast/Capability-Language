package compiler

import (
	"sort"

	"capabilitylanguage/internal/ast"
	"capabilitylanguage/internal/diagnostic"
)

type ReferenceLocation struct {
	Kind    string
	Name    string
	Context string
	Span    diagnostic.Span
}

func ReferencesAt(sources []SourceFile, path string, line, column int, includeDeclaration bool) []ReferenceLocation {
	target, ok := DefinitionAt(sources, path, line, column)
	if !ok {
		return nil
	}
	parsed := ParseSources(sources)
	bag := diagnostic.Bag{}
	c := newCompiler(parsed.Program, &bag)
	collector := referenceCollector{compiler: c, program: parsed.Program, target: target}
	var refs []ReferenceLocation
	if includeDeclaration {
		refs = append(refs, ReferenceLocation(target))
	}
	refs = append(refs, collector.collect()...)
	return dedupeAndSortReferences(refs)
}

type referenceCollector struct {
	compiler *compiler
	program  ast.Program
	target   DefinitionLocation
}

func (c referenceCollector) collect() []ReferenceLocation {
	var refs []ReferenceLocation
	for _, dep := range c.program.Dependencies {
		if c.matchesContext(dep.TargetContext) {
			refs = append(refs, c.reference("context", dep.TargetContext, dep.SourceContext, dep.Span))
		}
	}
	for _, event := range c.program.Events {
		context := declContext(event.Meta.ContextName)
		refs = append(refs, c.payloadReferences(event.Payload, context, event.Span)...)
	}
	for _, cap := range c.program.Capabilities {
		context := declContext(cap.Meta.ContextName)
		refs = append(refs, c.capabilityReferences(cap, context)...)
	}
	return refs
}

func (c referenceCollector) capabilityReferences(cap ast.CapabilityDecl, context string) []ReferenceLocation {
	var refs []ReferenceLocation
	for _, intent := range cap.Intents {
		if c.matchesResolved("shape", intent.InputType, context, intent.Span) {
			refs = append(refs, c.reference("shape", intent.InputType, context, intent.Span))
		}
	}
	for _, actor := range cap.Actors {
		if c.matchesResolved("actor", actor.Actor, context, actor.Span) {
			refs = append(refs, c.reference("actor", actor.Actor, context, actor.Span))
		}
	}
	for _, outcome := range cap.Outcomes {
		refs = append(refs, c.payloadReferences(outcome.Payload, context, outcome.Span)...)
	}
	for _, effect := range cap.Effects {
		if c.matchesResolved("effect", effect.Name, context, effect.Span) {
			refs = append(refs, c.reference("effect", effect.Name, context, effect.Span))
		}
	}
	for _, event := range cap.Events {
		if c.matchesResolved("event", event.Name, context, event.Span) {
			refs = append(refs, c.reference("event", event.Name, context, event.Span))
		}
	}
	for _, policy := range cap.Policies {
		if c.matchesResolved("policy", policy.Name, context, policy.Span) {
			refs = append(refs, c.reference("policy", policy.Name, context, policy.Span))
		}
		switch policy.TargetKind {
		case "event", "effect":
			if c.matchesResolved(policy.TargetKind, policy.TargetName, context, policy.Span) {
				refs = append(refs, c.reference(policy.TargetKind, policy.TargetName, context, policy.Span))
			}
		case "outcome":
			if c.matchesOutcome(cap, context, policy.TargetName) {
				refs = append(refs, c.reference("outcome", policy.TargetName, context, policy.Span))
			}
		case "lifecycle":
			if c.matchesLifecycle(cap, context) {
				refs = append(refs, c.reference("lifecycle", lifecycleName(cap), context, policy.Span))
			}
		case "capability":
			if c.matchesCapability(cap, context, cap.Name) {
				refs = append(refs, c.reference("capability", cap.Name, context, policy.Span))
			}
		}
	}
	for _, observation := range cap.Observe {
		switch observation.TargetKind {
		case "event", "effect", "capability":
			if c.matchesResolved(observation.TargetKind, observation.TargetName, context, observation.Span) {
				refs = append(refs, c.reference(observation.TargetKind, observation.TargetName, context, observation.Span))
			}
		case "outcome":
			if c.matchesOutcome(cap, context, observation.TargetName) {
				refs = append(refs, c.reference("outcome", observation.TargetName, context, observation.Span))
			}
		case "lifecycle":
			if c.matchesLifecycle(cap, context) {
				refs = append(refs, c.reference("lifecycle", lifecycleName(cap), context, observation.Span))
			}
		}
	}
	for _, branch := range cap.When {
		if branch.SourceKind == "policy" {
			if c.matchesResolved("policy", branch.SourceName, context, branch.Span) {
				refs = append(refs, c.reference("policy", branch.SourceName, context, branch.Span))
			}
		} else if branch.SourceKind == "effect" || branch.SourceKind == "" {
			if c.matchesResolved("effect", branch.SourceName, context, branch.Span) {
				refs = append(refs, c.reference("effect", branch.SourceName, context, branch.Span))
			}
		}
		if c.matchesOutcome(cap, context, branch.Outcome) {
			refs = append(refs, c.reference("outcome", branch.Outcome, context, branch.Span))
		}
	}
	if cap.Lifecycle != nil {
		refs = append(refs, c.lifecycleReferences(cap, context, *cap.Lifecycle)...)
	}
	return refs
}

func (c referenceCollector) payloadReferences(payload ast.Payload, context string, span diagnostic.Span) []ReferenceLocation {
	if payload.NamedType == "" || !c.matchesResolved("shape", payload.NamedType, context, span) {
		return nil
	}
	return []ReferenceLocation{c.reference("shape", payload.NamedType, context, span)}
}

func (c referenceCollector) lifecycleReferences(cap ast.CapabilityDecl, context string, lifecycle ast.LifecycleDecl) []ReferenceLocation {
	var refs []ReferenceLocation
	for _, contributor := range lifecycle.Contributors {
		if c.matchesResolved("capability", contributor.Capability, context, contributor.Span) {
			refs = append(refs, c.reference("capability", contributor.Capability, context, contributor.Span))
		}
	}
	for _, step := range lifecycle.Steps {
		if step.DecisionProvider != "" && c.matchesResolved("actor", step.DecisionProvider, context, step.Span) {
			refs = append(refs, c.reference("actor", step.DecisionProvider, context, step.Span))
		}
		for _, wait := range step.Waits {
			switch wait.SignalKind {
			case "event":
				if c.matchesResolved("event", wait.SignalName, context, wait.Span) {
					refs = append(refs, c.reference("event", wait.SignalName, context, wait.Span))
				}
			case "outcome":
				if c.matchesOutcome(cap, context, wait.SignalName) {
					refs = append(refs, c.reference("outcome", wait.SignalName, context, wait.Span))
				}
			}
			if wait.SourceCapability != "" && c.matchesResolved("capability", wait.SourceCapability, context, wait.Span) {
				refs = append(refs, c.reference("capability", wait.SourceCapability, context, wait.Span))
			}
		}
		for _, deadline := range step.Deadlines {
			switch deadline.ConsequenceKind {
			case "event", "effect", "capability":
				if c.matchesResolved(deadline.ConsequenceKind, deadline.ConsequenceSymbol, context, deadline.Span) {
					refs = append(refs, c.reference(deadline.ConsequenceKind, deadline.ConsequenceSymbol, context, deadline.Span))
				}
			case "outcome":
				if c.matchesOutcome(cap, context, deadline.ConsequenceSymbol) {
					refs = append(refs, c.reference("outcome", deadline.ConsequenceSymbol, context, deadline.Span))
				}
			}
		}
		for _, recovery := range step.RecoveryActions {
			if c.matchesResolved("capability", recovery.Target, context, recovery.Span) {
				refs = append(refs, c.reference("capability", recovery.Target, context, recovery.Span))
			}
			if c.matchesResolved("effect", recovery.Target, context, recovery.Span) {
				refs = append(refs, c.reference("effect", recovery.Target, context, recovery.Span))
			}
		}
	}
	for _, transition := range lifecycle.Transitions {
		switch transition.TriggerKind {
		case "event":
			if c.matchesResolved("event", transition.TriggerName, context, transition.Span) {
				refs = append(refs, c.reference("event", transition.TriggerName, context, transition.Span))
			}
		case "outcome":
			if transition.SourceCapability != "" {
				if sourceCap, ok := c.compiler.resolveTransitionSourceCapability(transition.SourceCapability, context, transition.Span); ok {
					sourceContext := declContext(sourceCap.Meta.ContextName)
					if c.matchesOutcome(sourceCap, sourceContext, transition.TriggerName) {
						refs = append(refs, c.reference("outcome", transition.TriggerName, sourceContext, transition.Span))
					}
				}
			} else if c.matchesOutcome(cap, context, transition.TriggerName) {
				refs = append(refs, c.reference("outcome", transition.TriggerName, context, transition.Span))
			}
		}
		if transition.SourceCapability != "" && c.matchesResolved("capability", transition.SourceCapability, context, transition.Span) {
			refs = append(refs, c.reference("capability", transition.SourceCapability, context, transition.Span))
		}
	}
	return refs
}

func (c referenceCollector) matchesResolved(kind, name, context string, span diagnostic.Span) bool {
	if c.target.Kind != kind {
		return false
	}
	info, ok := c.compiler.resolve(kind, name, context, span, false)
	return ok && info.Kind == c.target.Kind && info.Name == c.target.Name && info.Context == c.target.Context
}

func (c referenceCollector) matchesOutcome(cap ast.CapabilityDecl, context, name string) bool {
	return c.target.Kind == "outcome" && c.target.Name == name && c.target.Context == context && outcomeBelongsTo(cap, name)
}

func (c referenceCollector) matchesLifecycle(cap ast.CapabilityDecl, context string) bool {
	return c.target.Kind == "lifecycle" && c.target.Context == context && c.target.Name == lifecycleName(cap)
}

func (c referenceCollector) matchesCapability(cap ast.CapabilityDecl, context, name string) bool {
	return c.target.Kind == "capability" && c.target.Context == context && c.target.Name == name && cap.Name == name
}

func (c referenceCollector) matchesContext(name string) bool {
	return c.target.Kind == "context" && c.target.Name == name
}

func (c referenceCollector) reference(kind, name, context string, span diagnostic.Span) ReferenceLocation {
	return ReferenceLocation{Kind: kind, Name: name, Context: context, Span: span}
}

func outcomeBelongsTo(cap ast.CapabilityDecl, name string) bool {
	for _, outcome := range cap.Outcomes {
		if outcome.Name == name {
			return true
		}
	}
	return false
}

func lifecycleName(cap ast.CapabilityDecl) string {
	if cap.Lifecycle == nil || cap.Lifecycle.Name == "" {
		return "Lifecycle"
	}
	return cap.Lifecycle.Name
}

func dedupeAndSortReferences(refs []ReferenceLocation) []ReferenceLocation {
	seen := map[diagnostic.Span]bool{}
	var out []ReferenceLocation
	for _, ref := range refs {
		if ref.Span.File == "" || seen[ref.Span] {
			continue
		}
		seen[ref.Span] = true
		out = append(out, ref)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Span.File != out[j].Span.File {
			return out[i].Span.File < out[j].Span.File
		}
		if out[i].Span.Line != out[j].Span.Line {
			return out[i].Span.Line < out[j].Span.Line
		}
		if out[i].Span.Column != out[j].Span.Column {
			return out[i].Span.Column < out[j].Span.Column
		}
		return out[i].Kind < out[j].Kind
	})
	return out
}
