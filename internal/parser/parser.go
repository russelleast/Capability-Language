package parser

import (
	"fmt"
	"strings"

	"capabilitylanguage/internal/ast"
	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/lexer"
)

type Parser struct {
	tokens []lexer.Token
	pos    int
	diags  diagnostic.Bag
}

func Parse(tokens []lexer.Token) (*ast.Program, []diagnostic.Diagnostic) {
	p := &Parser{tokens: tokens}
	prog := &ast.Program{}
	for !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.EOF) {
			break
		}
		switch p.peek().Text {
		case "shape":
			prog.Shapes = append(prog.Shapes, p.parseShape())
		case "actor":
			prog.Actors = append(prog.Actors, p.parseActor())
		case "event":
			prog.Events = append(prog.Events, p.parseEvent())
		case "effect":
			prog.Effects = append(prog.Effects, p.parseEffect())
		case "policy":
			prog.Policies = append(prog.Policies, p.parsePolicy())
		case "capability":
			prog.Capabilities = append(prog.Capabilities, p.parseCapability())
		default:
			tok := p.advance()
			p.diags.Error("DCL_PARSE_EXPECTED_DECLARATION", "expected declaration", tok.Span, tok.Text)
			p.synchronizeTopLevel()
		}
	}
	return prog, p.diags.Items()
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
	p.expect(lexer.LBrace, "{")
	var kind string
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.matchText("kind") {
			kind = p.expectIdent("actor kind").Text
			continue
		}
		if !p.at(lexer.RBrace) {
			p.diags.Error("DCL_PARSE_UNEXPECTED_TOKEN", "expected actor property", p.peek().Span, p.peek().Text)
			p.advance()
		}
	}
	p.expect(lexer.RBrace, "}")
	return ast.ActorDecl{Name: name.Text, Kind: kind, Span: start.Span}
}

func (p *Parser) parseEffect() ast.EffectDecl {
	start := p.expectText("effect")
	name := p.expectIdent("effect name")
	p.expect(lexer.LBrace, "{")
	kind := p.parseKindBlock("effect")
	return ast.EffectDecl{Name: name.Text, Kind: kind, Span: start.Span}
}

func (p *Parser) parsePolicy() ast.PolicyDecl {
	start := p.expectText("policy")
	name := p.expectIdent("policy name")
	p.expect(lexer.LBrace, "{")
	kind := p.parseKindBlock("policy")
	return ast.PolicyDecl{Name: name.Text, Kind: kind, Span: start.Span}
}

func (p *Parser) parseKindBlock(owner string) string {
	var kind string
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.matchText("kind") {
			kind = p.expectIdent(owner + " kind").Text
			continue
		}
		if !p.at(lexer.RBrace) {
			p.diags.Error("DCL_PARSE_UNEXPECTED_TOKEN", "expected "+owner+" property", p.peek().Span, p.peek().Text)
			p.advance()
		}
	}
	p.expect(lexer.RBrace, "}")
	return kind
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
		case "input":
			intent := p.parseInput()
			cap.Input = &intent
		case "intents":
			cap.Intents = append(cap.Intents, p.parseIntentsBlock()...)
		case "actors":
			cap.Actors = append(cap.Actors, p.parseActorsBlock()...)
		case "outcomes":
			cap.Outcomes = append(cap.Outcomes, p.parseOutcomesBlock()...)
		case "rules":
			cap.Rules = append(cap.Rules, p.parseRulesBlock()...)
		case "effects":
			cap.Effects = append(cap.Effects, p.parseEffectsBlock()...)
		case "policies":
			cap.Policies = append(cap.Policies, p.parsePoliciesBlock()...)
		case "when":
			cap.When = append(cap.When, p.parseWhenBlock()...)
		case "emits":
			cap.Emits = append(cap.Emits, p.parseEmitsBlock()...)
		case "lifecycle":
			lifecycle := p.parseLifecycleBlock()
			cap.Lifecycle = &lifecycle
		default:
			tok := p.advance()
			p.diags.Error("DCL_PARSE_UNKNOWN_CAPABILITY_SECTION", "unknown capability section", tok.Span, tok.Text)
		}
	}
	p.expect(lexer.RBrace, "}")
	return cap
}

func (p *Parser) parseInput() ast.IntentDecl {
	start := p.expectText("input")
	inputType := p.parseType()
	p.expectText("from")
	actor := p.expectIdent("actor").Text
	return ast.IntentDecl{Name: "input", InputType: inputType, Actor: actor, Span: start.Span}
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
		if p.matchText("after") {
			use.After = p.expectIdent("effect dependency").Text
		}
		effects = append(effects, use)
	}
	p.expect(lexer.RBrace, "}")
	return effects
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
		if p.matchText("applies") {
			p.expectText("to")
			use.TargetKind = p.expectIdent("policy target kind").Text
			use.TargetName = p.expectIdent("policy target name").Text
		}
		policies = append(policies, use)
	}
	p.expect(lexer.RBrace, "}")
	return policies
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
		if p.matchText("otherwise") {
			p.expect(lexer.Arrow, "=>")
			outcome := p.expectIdent("outcome").Text
			branches = append(branches, ast.WhenBranch{Otherwise: true, Outcome: outcome, Span: start.Span})
			continue
		}
		sourceKind := p.expectIdent("causation source kind").Text
		sourceName := p.expectIdent("causation source").Text
		decision := p.expectIdent("causation decision").Text
		p.expect(lexer.Arrow, "=>")
		outcome := p.expectIdent("outcome").Text
		branches = append(branches, ast.WhenBranch{SourceKind: sourceKind, SourceName: sourceName, Decision: decision, Outcome: outcome, Span: start.Span})
	}
	p.expect(lexer.RBrace, "}")
	return branches
}

func (p *Parser) parseEmitsBlock() []ast.EmitDecl {
	p.expectText("emits")
	p.expect(lexer.LBrace, "{")
	var emits []ast.EmitDecl
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		outcome := p.expectIdent("emitting outcome")
		p.expect(lexer.Arrow, "=>")
		event := p.expectIdent("event")
		emits = append(emits, ast.EmitDecl{Outcome: outcome.Text, Event: event.Text, Span: outcome.Span})
	}
	p.expect(lexer.RBrace, "}")
	return emits
}

func (p *Parser) parseLifecycleBlock() ast.LifecycleDecl {
	start := p.expectText("lifecycle")
	lifecycle := ast.LifecycleDecl{Span: start.Span}
	p.expect(lexer.LBrace, "{")
	for !p.at(lexer.RBrace) && !p.at(lexer.EOF) {
		p.skipNewlines()
		if p.at(lexer.RBrace) {
			break
		}
		switch p.peek().Text {
		case "begin":
			tok := p.advance()
			lifecycle.Begin = p.expectIdent("initial lifecycle step").Text
			if lifecycle.Span.Line == 0 {
				lifecycle.Span = tok.Span
			}
		case "end":
			p.advance()
			lifecycle.Ends = append(lifecycle.Ends, p.expectIdent("terminal lifecycle step").Text)
		case "step":
			p.advance()
			lifecycle.Steps = append(lifecycle.Steps, p.expectIdent("lifecycle step").Text)
		case "move":
			start := p.advance()
			from := p.expectIdent("from lifecycle step").Text
			p.expectText("to")
			to := p.expectIdent("to lifecycle step").Text
			p.expectText("on")
			triggerKind := p.expectIdent("trigger kind").Text
			triggerName := p.expectIdent("trigger name").Text
			lifecycle.Transitions = append(lifecycle.Transitions, ast.TransitionDecl{
				From: from, To: to, TriggerKind: triggerKind, TriggerName: triggerName, Span: start.Span,
			})
		default:
			tok := p.advance()
			p.diags.Error("DCL_PARSE_UNEXPECTED_TOKEN", "expected lifecycle statement", tok.Span, tok.Text)
		}
	}
	p.expect(lexer.RBrace, "}")
	return lifecycle
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
	return lexer.Token{Kind: kind, Span: tok.Span}
}

func (p *Parser) expectText(text string) lexer.Token {
	if p.peek().Kind == lexer.Ident && p.peek().Text == text {
		return p.advance()
	}
	tok := p.peek()
	p.diags.Error("DCL_PARSE_EXPECTED_TOKEN", "expected "+text, tok.Span, tok.Text)
	return lexer.Token{Kind: lexer.Ident, Text: text, Span: tok.Span}
}

func (p *Parser) expectIdent(label string) lexer.Token {
	if p.peek().Kind == lexer.Ident {
		return p.advance()
	}
	tok := p.peek()
	p.diags.Error("DCL_PARSE_EXPECTED_IDENTIFIER", "expected "+label, tok.Span, tok.Text)
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
