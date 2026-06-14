package parser

import (
	"fmt"
	"strings"

	"capabilitylanguage/internal/ast"
	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/lexer"
)

type Parser struct {
	tokens         []lexer.Token
	pos            int
	diags          diagnostic.Bag
	currentContext string
	contextDepth   int
}

func Parse(tokens []lexer.Token) (*ast.Program, []diagnostic.Diagnostic) {
	p := &Parser{tokens: tokens, currentContext: "default"}
	prog := &ast.Program{}
	for !p.at(lexer.EOF) {
		p.parseTopLevel(prog)
	}
	return prog, p.diags.Items()
}

func (p *Parser) parseTopLevel(prog *ast.Program) {
	p.skipNewlines()
	if p.at(lexer.EOF) {
		return
	}
	if p.at(lexer.RBrace) {
		tok := p.advance()
		p.diags.Error("DCL_PARSE_UNEXPECTED_TOKEN", "unexpected }", tok.Span, tok.Text)
		return
	}
	visibility := "public"
	if p.matchText("private") {
		visibility = "private"
	}
	switch p.peek().Text {
	case "context":
		if visibility == "private" {
			tok := p.peek()
			p.diags.Error("DCL_PARSE_PRIVATE_CONTEXT_UNSUPPORTED", "context declarations cannot be private", tok.Span, tok.Text)
		}
		p.parseContext(prog)
	case "depends":
		if visibility == "private" {
			tok := p.peek()
			p.diags.Error("DCL_PARSE_PRIVATE_DEPENDENCY_UNSUPPORTED", "dependency declarations cannot be private", tok.Span, tok.Text)
		}
		prog.Dependencies = append(prog.Dependencies, p.parseDependency())
	case "shape":
		decl := p.parseShape()
		decl.Meta = p.declMeta(visibility)
		prog.Shapes = append(prog.Shapes, decl)
	case "actor":
		decl := p.parseActor()
		decl.Meta = p.declMeta(visibility)
		prog.Actors = append(prog.Actors, decl)
	case "event":
		decl := p.parseEvent()
		decl.Meta = p.declMeta(visibility)
		prog.Events = append(prog.Events, decl)
	case "effect":
		decl := p.parseEffect()
		decl.Meta = p.declMeta(visibility)
		prog.Effects = append(prog.Effects, decl)
	case "policy":
		decl := p.parsePolicy()
		decl.Meta = p.declMeta(visibility)
		prog.Policies = append(prog.Policies, decl)
	case "capability":
		decl := p.parseCapability()
		decl.Meta = p.declMeta(visibility)
		prog.Capabilities = append(prog.Capabilities, decl)
	default:
		tok := p.advance()
		p.diags.Error("DCL_PARSE_EXPECTED_DECLARATION", "expected declaration", tok.Span, tok.Text)
		p.synchronizeTopLevel()
	}
}

func (p *Parser) parseContext(prog *ast.Program) {
	start := p.expectText("context")
	nameTok := p.expectIdent("context name")
	name := nameTok.Text
	if p.contextDepth > 0 && p.currentContext != "default" && !strings.Contains(name, ".") {
		name = p.currentContext + "." + name
	}
	parent := parentContext(name)
	prog.Contexts = append(prog.Contexts, ast.ContextDecl{Name: name, Parent: parent, Span: start.Span})
	if p.match(lexer.LBrace) {
		previous := p.currentContext
		p.currentContext = name
		p.contextDepth++
		for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
			p.skipNewlines()
			if p.at(lexer.RBrace) {
				break
			}
			p.parseTopLevel(prog)
		}
		p.expect(lexer.RBrace, "}")
		p.contextDepth--
		p.currentContext = previous
		return
	}
	p.currentContext = name
}

func (p *Parser) parseDependency() ast.DependencyDecl {
	start := p.expectText("depends")
	p.expectText("on")
	target := p.expectIdent("context name").Text
	return ast.DependencyDecl{SourceContext: p.currentContext, TargetContext: target, Span: start.Span}
}

func (p *Parser) declMeta(visibility string) ast.DeclMeta {
	return ast.DeclMeta{ContextName: p.currentContext, Visibility: visibility}
}

func (p *Parser) parseShape() ast.ShapeDecl {
	start := p.expectText("shape")
	name := p.expectIdent("shape name")
	p.expect(lexer.LBrace, "{")
	fields := p.parseFields()
	return ast.ShapeDecl{Name: name.Text, Fields: fields, Span: start.Span}
}

func (p *Parser) parseActor() ast.ActorDecl {
	start := p.expectText("actor")
	name := p.expectIdent("actor name")
	p.expectText("is")
	kind := p.expectIdent("actor kind").Text
	return ast.ActorDecl{Name: name.Text, Kind: kind, Span: start.Span}
}

func (p *Parser) parseEffect() ast.EffectDecl {
	start := p.expectText("effect")
	name := p.expectIdent("effect name")
	p.expectText("is")
	kind := p.expectIdent("effect kind").Text
	return ast.EffectDecl{Name: name.Text, Kind: kind, Span: start.Span}
}

func (p *Parser) parsePolicy() ast.PolicyDecl {
	start := p.expectText("policy")
	name := p.expectIdent("policy name")
	policy := ast.PolicyDecl{Name: name.Text, Span: start.Span}
	if !p.match(lexer.LBrace) {
		tok := p.peek()
		p.diags.Error("DCL_PARSE_EXPECTED_TOKEN", "expected {", tok.Span, tok.Text)
		p.synchronizeTopLevel()
		return policy
	}
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		switch p.peek().Text {
		case "family":
			p.advance()
			policy.Family = p.expectIdent("policy family").Text
		default:
			policy.Concerns = append(policy.Concerns, p.parseConcern())
		}
	}
	p.expect(lexer.RBrace, "}")
	return policy
}

func (p *Parser) parseConcern() ast.ConcernDecl {
	name := p.expectIdent("policy concern")
	concern := ast.ConcernDecl{Name: name.Text, Span: name.Span}
	if p.match(lexer.LBrace) {
		for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
			p.skipNewlines()
			if p.at(lexer.RBrace) {
				break
			}
			paramName := p.expectIdent("concern parameter")
			values := p.collectConcernParameterValues()
			concern.Parameters = append(concern.Parameters, ast.ConcernParameter{Name: paramName.Text, Values: values, Span: paramName.Span})
		}
		p.expect(lexer.RBrace, "}")
		return concern
	}
	values := p.collectConcernValues()
	if len(values) > 0 {
		concern.Parameters = append(concern.Parameters, ast.ConcernParameter{Name: "value", Values: values, Span: name.Span})
	}
	return concern
}

func (p *Parser) collectConcernParameterValues() []string {
	var values []string
	for !p.at(lexer.EOF) && !p.at(lexer.Newline) && !p.at(lexer.RBrace) {
		if len(values) > 0 && isConcernParameterName(p.peek().Text) {
			break
		}
		values = append(values, p.advance().Text)
	}
	return values
}

func (p *Parser) collectConcernValues() []string {
	var values []string
	for !p.at(lexer.EOF) && !p.at(lexer.Newline) && !p.at(lexer.RBrace) {
		values = append(values, p.advance().Text)
	}
	return values
}

func (p *Parser) parseEvent() ast.EventDecl {
	start := p.expectText("event")
	name := p.expectIdent("event name")
	p.expectText("is")
	payload := p.parsePayload()
	return ast.EventDecl{Name: name.Text, Payload: payload, Span: start.Span}
}

func (p *Parser) parsePayload() ast.Payload {
	if p.match(lexer.LBrace) {
		return ast.Payload{Fields: p.parseFieldsBody()}
	}
	return ast.Payload{NamedType: p.parseType()}
}

func (p *Parser) parseFields() []ast.Field {
	return p.parseFieldsBody()
}

func (p *Parser) parseFieldsBody() []ast.Field {
	var fields []ast.Field
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		name := p.expectIdent("field name")
		p.expect(lexer.Colon, ":")
		fieldType := p.parseType()
		required := p.matchText("required")
		fields = append(fields, ast.Field{Name: name.Text, Type: fieldType, Required: required, Span: name.Span})
	}
	p.expect(lexer.RBrace, "}")
	return fields
}

func (p *Parser) parseType() string {
	name := p.expectIdent("type").Text
	if name == "List" && p.match(lexer.Less) {
		inner := p.parseType()
		p.expect(lexer.Greater, ">")
		return "List<" + inner + ">"
	}
	return name
}

func (p *Parser) parseCapability() ast.CapabilityDecl {
	start := p.expectText("capability")
	name := p.expectIdent("capability name")
	cap := ast.CapabilityDecl{Name: name.Text, Span: start.Span}
	p.expect(lexer.LBrace, "{")
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		switch p.peek().Text {
		case "intent":
			cap.Intents = append(cap.Intents, p.parseIntent())
		case "intents":
			cap.Intents = append(cap.Intents, p.parseIntentsBlock()...)
		case "actors":
			cap.Actors = append(cap.Actors, p.parseActorsBlock()...)
		case "outcome":
			cap.Outcomes = append(cap.Outcomes, p.parseOutcome())
		case "outcomes":
			cap.Outcomes = append(cap.Outcomes, p.parseOutcomesBlock()...)
		case "rule":
			cap.Rules = append(cap.Rules, p.parseRule())
		case "rules":
			cap.Rules = append(cap.Rules, p.parseRulesBlock()...)
		case "effect":
			cap.Effects = append(cap.Effects, p.parseEffectUse())
		case "effects":
			cap.Effects = append(cap.Effects, p.parseEffectsBlock()...)
		case "events":
			cap.Events = append(cap.Events, p.parseCapabilityEventsBlock()...)
		case "policies":
			cap.Policies = append(cap.Policies, p.parsePoliciesBlock()...)
		case "observe":
			cap.Observe = append(cap.Observe, p.parseObserveBlock()...)
		case "when":
			cap.When = append(cap.When, p.parseWhenBlock()...)
		case "lifecycle":
			lifecycle := p.parseLifecycleBlock(false)
			cap.Lifecycle = &lifecycle
		case "supervises":
			lifecycle := p.parseSupervisesLifecycleBlock()
			cap.Lifecycle = &lifecycle
		default:
			tok := p.advance()
			p.diags.Error("DCL_PARSE_UNKNOWN_CAPABILITY_SECTION", "unknown capability section", tok.Span, tok.Text)
		}
	}
	p.expect(lexer.RBrace, "}")
	return cap
}

func (p *Parser) parseIntent() ast.IntentDecl {
	start := p.expectText("intent")
	inputType := p.parseType()
	p.expectText("from")
	actor := p.expectIdent("actor").Text
	return ast.IntentDecl{Name: inputType, InputType: inputType, Actor: actor, Span: start.Span}
}

func (p *Parser) parseIntentsBlock() []ast.IntentDecl {
	p.expectText("intents")
	p.expect(lexer.LBrace, "{")
	var intents []ast.IntentDecl
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		name := p.expectIdent("intent name")
		p.expectText("with")
		inputType := p.parseType()
		p.expectText("from")
		actor := p.expectIdent("actor").Text
		intents = append(intents, ast.IntentDecl{Name: name.Text, InputType: inputType, Actor: actor, Span: name.Span})
	}
	p.expect(lexer.RBrace, "}")
	return intents
}

func (p *Parser) parseActorsBlock() []ast.ActorRole {
	p.expectText("actors")
	p.expect(lexer.LBrace, "{")
	var actors []ast.ActorRole
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		role := p.expectIdent("actor role")
		p.expect(lexer.Colon, ":")
		actor := p.expectIdent("actor").Text
		actors = append(actors, ast.ActorRole{Role: role.Text, Actor: actor, Span: role.Span})
	}
	p.expect(lexer.RBrace, "}")
	return actors
}

func (p *Parser) parseOutcome() ast.OutcomeDecl {
	start := p.expectText("outcome")
	name := p.expectIdent("outcome")
	var payload ast.Payload
	if p.matchText("is") {
		payload = p.parsePayload()
	}
	return ast.OutcomeDecl{Name: name.Text, Payload: payload, Span: start.Span}
}

func (p *Parser) parseOutcomesBlock() []ast.OutcomeDecl {
	p.expectText("outcomes")
	p.expect(lexer.LBrace, "{")
	var outcomes []ast.OutcomeDecl
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		name := p.expectIdent("outcome")
		var payload ast.Payload
		if p.matchText("is") {
			payload = p.parsePayload()
		}
		outcomes = append(outcomes, ast.OutcomeDecl{Name: name.Text, Payload: payload, Span: name.Span})
	}
	p.expect(lexer.RBrace, "}")
	return outcomes
}

func (p *Parser) parseRule() ast.RuleDecl {
	start := p.expectText("rule")
	name := p.expectIdent("rule name")
	p.expect(lexer.Colon, ":")
	expr := p.collectRuleExpressionLine()
	return ast.RuleDecl{Name: name.Text, Expression: expr, Span: start.Span}
}

func (p *Parser) parseRulesBlock() []ast.RuleDecl {
	p.expectText("rules")
	p.expect(lexer.LBrace, "{")
	var rules []ast.RuleDecl
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		name := p.expectIdent("rule name")
		p.expect(lexer.Colon, ":")
		expr := p.collectRuleExpression()
		rules = append(rules, ast.RuleDecl{Name: name.Text, Expression: expr, Span: name.Span})
	}
	p.expect(lexer.RBrace, "}")
	return rules
}

func (p *Parser) collectRuleExpression() string {
	var parts []string
	for !p.at(lexer.EOF) && !p.at(lexer.RBrace) {
		if p.at(lexer.Newline) {
			check := p.pos
			for check < len(p.tokens) && p.tokens[check].Kind == lexer.Newline {
				check++
			}
			if check < len(p.tokens) && p.tokens[check].Kind == lexer.RBrace {
				break
			}
			if check+1 < len(p.tokens) && p.tokens[check].Kind == lexer.Ident && p.tokens[check+1].Kind == lexer.Colon {
				break
			}
			parts = append(parts, " ")
			p.advance()
			continue
		}
		parts = append(parts, p.advance().Text)
	}
	return normalizeParts(parts)
}

func (p *Parser) collectRuleExpressionLine() string {
	var parts []string
	for !p.at(lexer.EOF) && !p.at(lexer.Newline) && !p.at(lexer.RBrace) {
		parts = append(parts, p.advance().Text)
	}
	return normalizeParts(parts)
}

func (p *Parser) parseEffectUse() ast.EffectUse {
	start := p.expectText("effect")
	name := p.expectIdent("effect")
	use := ast.EffectUse{Name: name.Text, Span: start.Span}
	if p.matchText("is") {
		kind := p.expectIdent("effect kind")
		p.diags.Error("DCL_PARSE_LOCAL_EFFECT_DECL_UNSUPPORTED", "capability-local effect declarations are not part of v0.2", kind.Span, kind.Text)
	}
	if p.matchText("after") {
		use.After = p.expectIdent("effect dependency").Text
	}
	return use
}

func (p *Parser) parseEffectsBlock() []ast.EffectUse {
	p.expectText("effects")
	p.expect(lexer.LBrace, "{")
	var effects []ast.EffectUse
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		name := p.expectIdent("effect")
		use := ast.EffectUse{Name: name.Text, Span: name.Span}
		if p.matchText("is") {
			kind := p.expectIdent("effect kind")
			p.diags.Error("DCL_PARSE_LOCAL_EFFECT_DECL_UNSUPPORTED", "capability-local effect declarations are not part of v0.2", kind.Span, kind.Text)
		}
		if p.matchText("after") {
			use.After = p.expectIdent("effect dependency").Text
		}
		effects = append(effects, use)
	}
	p.expect(lexer.RBrace, "}")
	return effects
}

func (p *Parser) parseCapabilityEventsBlock() []ast.EventEmissionDecl {
	p.expectText("events")
	p.expect(lexer.LBrace, "{")
	var events []ast.EventEmissionDecl
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		start := p.expectText("emits")
		name := p.expectIdent("emitted event")
		events = append(events, ast.EventEmissionDecl{Name: name.Text, Span: start.Span})
	}
	p.expect(lexer.RBrace, "}")
	return events
}

func (p *Parser) parsePoliciesBlock() []ast.PolicyUse {
	p.expectText("policies")
	p.expect(lexer.LBrace, "{")
	var policies []ast.PolicyUse
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		name := p.expectIdent("policy")
		use := ast.PolicyUse{Name: name.Text, Span: name.Span}
		p.expectText("governs")
		target := p.expectIdent("policy target").Text
		switch target {
		case "capability", "lifecycle":
			use.TargetKind = target
		case "effect", "outcome", "event":
			use.TargetKind = target
			use.TargetName = p.expectIdent("policy target name").Text
		default:
			if isPolicyTargetKindToken(target) {
				use.TargetKind = target
				use.TargetName = p.expectIdent("policy target name").Text
			} else {
				use.TargetKind = "effect"
				use.TargetName = target
			}
		}
		policies = append(policies, use)
	}
	p.expect(lexer.RBrace, "}")
	return policies
}

func (p *Parser) parseObserveBlock() []ast.ObservationDecl {
	p.expectText("observe")
	p.expect(lexer.LBrace, "{")
	var observations []ast.ObservationDecl
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		start := p.peek()
		targetKind := p.expectIdent("observation target kind").Text
		obs := ast.ObservationDecl{TargetKind: targetKind, Span: start.Span}
		switch targetKind {
		case "effect", "outcome", "event":
			obs.TargetName = p.expectIdent("observation target").Text
		default:
			if !p.at(lexer.Newline) && !p.at(lexer.RBrace) && !p.at(lexer.EOF) && !isObservationTypeToken(p.peek().Text) && p.peek().Text != "as" {
				obs.TargetName = p.expectIdent("observation target").Text
			}
		}
		p.skipNewlines()
		obsType := p.expectIdent("observation type").Text
		if obsType == "count" && p.peek().Kind == lexer.Ident && p.peek().Text != "as" {
			obsType = p.advance().Text
		}
		obs.ObservationType = obsType
		if p.matchText("as") {
			obs.MetricName = p.expectIdent("metric name").Text
		}
		observations = append(observations, obs)
	}
	p.expect(lexer.RBrace, "}")
	return observations
}

func (p *Parser) parseWhenBlock() []ast.WhenBranch {
	p.expectText("when")
	p.expect(lexer.LBrace, "{")
	var branches []ast.WhenBranch
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		start := p.peek()
		if p.matchText("always") {
			p.expectText("then")
			outcome := p.expectIdent("outcome").Text
			branches = append(branches, ast.WhenBranch{Always: true, Outcome: outcome, Span: start.Span})
			continue
		}
		if p.matchText("otherwise") {
			p.expectText("then")
			outcome := p.expectIdent("outcome").Text
			branches = append(branches, ast.WhenBranch{Otherwise: true, Outcome: outcome, Span: start.Span})
			continue
		}
		source := p.expectIdent("causation source")
		sourceKind := ""
		sourceName := source.Text
		if source.Text == "policy" {
			sourceKind = "policy"
			sourceName = p.expectIdent("policy causation source").Text
		}
		decision := p.expectIdent("causation decision").Text
		p.expectText("then")
		outcome := p.expectIdent("outcome").Text
		branches = append(branches, ast.WhenBranch{SourceKind: sourceKind, SourceName: sourceName, Decision: decision, Outcome: outcome, Span: start.Span})
	}
	p.expect(lexer.RBrace, "}")
	return branches
}

func (p *Parser) parseSupervisesLifecycleBlock() ast.LifecycleDecl {
	p.expectText("supervises")
	p.expectText("lifecycle")
	name := p.expectIdent("lifecycle name")
	lifecycle := p.parseLifecycleBody(name.Span)
	lifecycle.Name = name.Text
	lifecycle.Supervised = true
	return lifecycle
}

func (p *Parser) parseLifecycleBlock(supervised bool) ast.LifecycleDecl {
	start := p.expectText("lifecycle")
	lifecycle := p.parseLifecycleBody(start.Span)
	lifecycle.Supervised = supervised
	return lifecycle
}

func (p *Parser) parseLifecycleBody(span diagnostic.Span) ast.LifecycleDecl {
	lifecycle := ast.LifecycleDecl{Span: span}
	p.expect(lexer.LBrace, "{")
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		switch p.peek().Text {
		case "identity":
			p.advance()
			lifecycle.Identity = p.expectIdent("lifecycle identity").Text
		case "contributors":
			lifecycle.Contributors = append(lifecycle.Contributors, p.parseContributorsBlock()...)
		case "begin":
			tok := p.advance()
			p.matchText("step")
			lifecycle.Begin = p.expectIdent("initial lifecycle step").Text
			if lifecycle.Span.Line == 0 {
				lifecycle.Span = tok.Span
			}
		case "end":
			p.advance()
			p.matchText("step")
			name := p.expectIdent("terminal lifecycle step")
			lifecycle.Ends = append(lifecycle.Ends, name.Text)
			lifecycle.Steps = append(lifecycle.Steps, ast.LifecycleStepDecl{Name: name.Text, IsTerminal: true, Span: name.Span})
		case "step":
			lifecycle.Steps = append(lifecycle.Steps, p.parseLifecycleStep())
		case "move":
			start := p.advance()
			from := p.expectIdent("from lifecycle step").Text
			p.expectText("to")
			to := p.expectIdent("to lifecycle step").Text
			p.skipNewlines()
			p.expectText("on")
			triggerKind := p.expectIdent("trigger kind").Text
			triggerName := p.expectIdent("trigger name").Text
			p.skipNewlines()
			sourceCapability := ""
			if p.matchText("from") {
				sourceCapability = p.expectIdent("source capability").Text
			}
			lifecycle.Transitions = append(lifecycle.Transitions, ast.TransitionDecl{
				From: from, To: to, TriggerKind: triggerKind, TriggerName: triggerName, SourceCapability: sourceCapability, Span: start.Span,
			})
		default:
			tok := p.advance()
			p.diags.Error("DCL_PARSE_UNEXPECTED_TOKEN", "expected lifecycle statement", tok.Span, tok.Text)
		}
	}
	p.expect(lexer.RBrace, "}")
	return lifecycle
}

func (p *Parser) parseContributorsBlock() []ast.ContributorDecl {
	p.expectText("contributors")
	p.expect(lexer.LBrace, "{")
	var contributors []ast.ContributorDecl
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		name := p.expectIdent("contributor capability")
		contributors = append(contributors, ast.ContributorDecl{Capability: name.Text, Span: name.Span})
	}
	p.expect(lexer.RBrace, "}")
	return contributors
}

func (p *Parser) parseLifecycleStep() ast.LifecycleStepDecl {
	start := p.expectText("step")
	name := p.expectIdent("lifecycle step")
	step := ast.LifecycleStepDecl{Name: name.Text, Span: start.Span}
	for !p.at(lexer.LBrace) && !p.at(lexer.Newline) && !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.parseLifecycleStepMarker(&step)
	}
	if !p.match(lexer.LBrace) {
		return step
	}
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		switch p.peek().Text {
		case "kind":
			p.advance()
			step.Kind = p.expectIdent("step kind").Text
		case "waits":
			step.Waits = append(step.Waits, p.parseWaitTrigger())
		case "requires":
			p.parseDecisionRequirement(&step)
		case "deadline":
			step.Deadlines = append(step.Deadlines, p.parseDeadline())
		case "recovery":
			start := p.advance()
			target := p.expectIdent("recovery target")
			step.RecoveryActions = append(step.RecoveryActions, ast.RecoveryDecl{Target: target.Text, Span: start.Span})
		default:
			tok := p.advance()
			p.diags.Error("DCL_PARSE_UNEXPECTED_TOKEN", "expected lifecycle step statement", tok.Span, tok.Text)
		}
	}
	p.expect(lexer.RBrace, "}")
	return step
}

func (p *Parser) parseLifecycleStepMarker(step *ast.LifecycleStepDecl) {
	switch p.peek().Text {
	case "waits":
		step.Waits = append(step.Waits, p.parseWaitTrigger())
	case "requires":
		p.parseDecisionRequirement(step)
	default:
		tok := p.advance()
		p.diags.Error("DCL_PARSE_UNEXPECTED_TOKEN", "expected lifecycle step marker", tok.Span, tok.Text)
	}
}

func (p *Parser) parseDecisionRequirement(step *ast.LifecycleStepDecl) {
	p.expectText("requires")
	p.expectText("decision")
	p.expectText("from")
	provider := p.expectIdent("decision provider")
	step.DecisionProvider = provider.Text
}

func (p *Parser) parseWaitTrigger() ast.WaitTriggerDecl {
	start := p.expectText("waits")
	p.expectText("for")
	signalKind := p.expectIdent("wait signal kind").Text
	signalName := p.expectIdent("wait signal name").Text
	sourceCapability := ""
	if p.matchText("from") {
		sourceCapability = p.expectIdent("wait source capability").Text
	}
	return ast.WaitTriggerDecl{SignalKind: signalKind, SignalName: signalName, SourceCapability: sourceCapability, Span: start.Span}
}

func (p *Parser) parseDeadline() ast.DeadlineDecl {
	start := p.expectText("deadline")
	var duration []string
	for !p.at(lexer.EOF) && !p.at(lexer.Newline) && !p.at(lexer.RBrace) && !(p.peek().Kind == lexer.Ident && p.peek().Text == "causing") {
		duration = append(duration, p.advance().Text)
	}
	p.expectText("causing")
	consequenceKind := p.expectIdent("deadline consequence kind").Text
	consequenceSymbol := p.expectIdent("deadline consequence symbol").Text
	return ast.DeadlineDecl{Duration: duration, ConsequenceKind: consequenceKind, ConsequenceSymbol: consequenceSymbol, Span: start.Span}
}

func (p *Parser) skipNewlines() {
	for p.at(lexer.Newline) {
		p.advance()
	}
}

func (p *Parser) at(kind lexer.Kind) bool {
	return p.peek().Kind == kind
}

func (p *Parser) peek() lexer.Token {
	if p.pos >= len(p.tokens) {
		return lexer.Token{Kind: lexer.EOF}
	}
	return p.tokens[p.pos]
}

func (p *Parser) advance() lexer.Token {
	tok := p.peek()
	if p.pos < len(p.tokens) {
		p.pos++
	}
	return tok
}

func (p *Parser) match(kind lexer.Kind) bool {
	if !p.at(kind) {
		return false
	}
	p.advance()
	return true
}

func (p *Parser) matchText(text string) bool {
	if p.peek().Kind != lexer.Ident || p.peek().Text != text {
		return false
	}
	p.advance()
	return true
}

func (p *Parser) expect(kind lexer.Kind, label string) lexer.Token {
	if p.at(kind) {
		return p.advance()
	}
	tok := p.peek()
	p.diags.Error("DCL_PARSE_EXPECTED_TOKEN", fmt.Sprintf("expected %s", label), tok.Span, tok.Text)
	if !p.at(lexer.EOF) {
		p.advance()
	}
	return lexer.Token{Kind: kind, Span: tok.Span}
}

func (p *Parser) expectText(text string) lexer.Token {
	if p.peek().Kind == lexer.Ident && p.peek().Text == text {
		return p.advance()
	}
	tok := p.peek()
	p.diags.Error("DCL_PARSE_EXPECTED_TOKEN", "expected "+text, tok.Span, tok.Text)
	if !p.at(lexer.EOF) {
		p.advance()
	}
	return lexer.Token{Kind: lexer.Ident, Text: text, Span: tok.Span}
}

func (p *Parser) expectIdent(label string) lexer.Token {
	if p.peek().Kind == lexer.Ident {
		return p.advance()
	}
	tok := p.peek()
	p.diags.Error("DCL_PARSE_EXPECTED_IDENTIFIER", "expected "+label, tok.Span, tok.Text)
	if !p.at(lexer.EOF) {
		p.advance()
	}
	return lexer.Token{Kind: lexer.Ident, Span: tok.Span}
}

func (p *Parser) synchronizeTopLevel() {
	for !p.at(lexer.EOF) && !p.at(lexer.Newline) {
		p.advance()
	}
}

func normalizeParts(parts []string) string {
	var clean []string
	for _, part := range parts {
		if strings.TrimSpace(part) != "" {
			clean = append(clean, strings.TrimSpace(part))
		}
	}
	return strings.Join(clean, " ")
}

func isObservationTypeToken(text string) bool {
	switch text {
	case "count", "duration", "violations", "failures", "transitions":
		return true
	default:
		return false
	}
}

func isPolicyTargetKindToken(text string) bool {
	switch text {
	case "capability", "effect", "outcome", "event", "lifecycle", "intent", "rule", "transition", "policy":
		return true
	default:
		return false
	}
}

func isConcernParameterName(text string) bool {
	switch text {
	case "attempts", "backoff", "opens", "resets":
		return true
	default:
		return false
	}
}

func parentContext(name string) string {
	idx := strings.LastIndex(name, ".")
	if idx <= 0 {
		return ""
	}
	return name[:idx]
}
