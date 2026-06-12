package compiler

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/lexer"
)

const helloWorld = `
actor User is human

shape HelloInput {
  name: Text required
}

shape GreetingResult {
  message: Text required
}

capability SayHello {
  intent HelloInput from User

  outcomes {
    Greeted is GreetingResult
    MissingName
  }

  rule NamePresent: input.name is present

  when {
    NamePresent violated then MissingName
    otherwise then Greeted
  }
}
`

const registration = `
actor Customer is human

effect SaveRegistration is persist
effect SendVerification is notify

policy SafeRetry {
  family reliability
}

shape RegisterCustomerInput {
  email: Email required
  acceptedTerms: Boolean required
}

event CustomerRegistered is {
  customerId: CustomerId required
  email: Email required
}

capability RegisterCustomer {
  intent RegisterCustomerInput from Customer

  outcomes {
    Accepted
    TermsNotAccepted
    VerificationDeferred
  }

  rules {
    TermsAccepted:
      input.acceptedTerms is true
  }

  effects {
    SaveRegistration
    SendVerification after SaveRegistration
  }

  policies {
    SafeRetry governs effect SendVerification
  }

  observe {
    capability duration
    outcome Accepted count as registrations_completed
    effect SendVerification count failures as verification_failures
  }

  when {
    TermsAccepted violated then TermsNotAccepted
    SendVerification unresolved then VerificationDeferred
    otherwise then Accepted
  }

  lifecycle {
    begin step Pending
    step Verified
    end step Rejected

    move Pending to Verified on event CustomerRegistered
    move Pending to Rejected on outcome VerificationDeferred
  }
}
`

const requestLeave = `
actor Employee is human
actor Manager is human

shape LeaveRequestInput {
  startDate: Date required
  endDate: Date required
}

capability RequestLeave {
  intent LeaveRequestInput from Employee

  actors {
    requester: Employee
    approver: Manager
  }

  outcome Requested
  outcomes {
    InvalidDates
    SelfApprovalAttempt
  }

  rules {
    DatesValid:
      input.startDate is less than input.endDate
      or input.startDate is equal to input.endDate

    SelfApprovalNotAllowed:
      actors.requester is not equal to actors.approver
  }

  when {
    DatesValid violated then InvalidDates
    SelfApprovalNotAllowed violated then SelfApprovalAttempt
    otherwise then Requested
  }
}
`

func TestLexerCoversV02Tokens(t *testing.T) {
	tokens, diags := lexer.Lex("test.dcl", "shape Order { items: List<OrderLine> required }\nwhen { otherwise then Accepted }")
	if len(diags) != 0 {
		t.Fatalf("unexpected diagnostics: %#v", diags)
	}
	wantKinds := map[lexer.Kind]bool{lexer.LBrace: false, lexer.RBrace: false, lexer.Colon: false, lexer.Less: false, lexer.Greater: false, lexer.Newline: false}
	for _, token := range tokens {
		if _, ok := wantKinds[token.Kind]; ok {
			wantKinds[token.Kind] = true
		}
	}
	for kind, seen := range wantKinds {
		if !seen {
			t.Fatalf("expected token kind %s", kind)
		}
	}
	if tokens[0].Span.Line != 1 || tokens[0].Span.Column != 1 {
		t.Fatalf("unexpected first span: %#v", tokens[0].Span)
	}
}

func TestDocumentedV02ExamplesCompile(t *testing.T) {
	for name, src := range map[string]string{
		"hello":        helloWorld,
		"registration": registration,
		"leave":        requestLeave,
	} {
		t.Run(name, func(t *testing.T) {
			result := CompileFiles([]string{writeTempDCL(t, src)})
			if HasErrors(result.Diagnostics) {
				t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
			}
			if len(result.IR.Capabilities) != 1 {
				t.Fatalf("expected one capability, got %d", len(result.IR.Capabilities))
			}
			if _, err := json.Marshal(result.IR); err != nil {
				t.Fatalf("IR should be JSON serializable: %v", err)
			}
		})
	}
}

func TestIntentNameIsAuthoredTypeForSingularIntent(t *testing.T) {
	result := CompileFiles([]string{writeTempDCL(t, helloWorld)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	intents := result.IR.Capabilities[0].Intents
	if len(intents) != 1 {
		t.Fatalf("expected one intent, got %d", len(intents))
	}
	if intents[0].Name != "HelloInput" {
		t.Fatalf("intent name should use authored type, got %q", intents[0].Name)
	}
}

func TestSingularAndBlockFormsCompileEquivalently(t *testing.T) {
	src := `
actor User is human
effect SendEmail is notify
policy SafeRetry {
  family reliability
}
shape Input { email: Email required }

capability NotifyUser {
  intents {
    Notify with Input from User
  }
  outcome Accepted
  rule EmailPresent: input.email is present
  effect SendEmail
  policies {
    SafeRetry governs SendEmail
  }
  when {
    EmailPresent violated then Accepted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	cap := result.IR.Capabilities[0]
	if cap.Intents[0].Name != "Notify" {
		t.Fatalf("expected named block intent, got %q", cap.Intents[0].Name)
	}
	if len(cap.Outcomes) != 1 || len(cap.Invariants) != 1 || len(cap.Effects) != 1 || len(cap.Policies) != 1 {
		t.Fatalf("unexpected normalized capability IR: %#v", cap)
	}
}

func TestV03PolicyAttachmentsAndObservationIR(t *testing.T) {
	src := `
actor Customer is human
effect SendVerification is notify
policy QualityEnvelope {
  family reliability
}
shape Input { email: Email required }
event CustomerRegistered is Input

capability RegisterCustomer {
  intent Input from Customer
  outcomes { Accepted Deferred }
  effect SendVerification
  policies {
    QualityEnvelope governs capability
    QualityEnvelope governs effect SendVerification
    QualityEnvelope governs outcome Accepted
    QualityEnvelope governs event CustomerRegistered
    QualityEnvelope governs lifecycle
  }
  observe {
    capability duration
    outcome Accepted count as registrations_completed
    effect SendVerification count failures as verification_failures
    lifecycle transitions
  }
  when {
    SendVerification unresolved then Deferred
    otherwise then Accepted
  }
  lifecycle {
    begin step Pending
    end step Done
    move Pending to Done on outcome Accepted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	if len(result.IR.Policies) != 1 {
		t.Fatalf("expected one policy, got %#v", result.IR.Policies)
	}
	policy := result.IR.Policies[0]
	if policy.Family != "reliability" || policy.Concern != "" {
		t.Fatalf("unexpected policy IR: %#v", policy)
	}
	cap := result.IR.Capabilities[0]
	if len(cap.Policies) != 5 {
		t.Fatalf("expected five policy attachments, got %#v", cap.Policies)
	}
	wantTargets := map[string]string{
		"capability": "RegisterCustomer",
		"effect":     "SendVerification",
		"outcome":    "Accepted",
		"event":      "CustomerRegistered",
		"lifecycle":  "RegisterCustomer",
	}
	for _, attachment := range cap.Policies {
		if wantTargets[attachment.TargetKind] != attachment.TargetName {
			t.Fatalf("unexpected attachment target: %#v", attachment)
		}
	}
	if len(result.IR.Observations) != 4 {
		t.Fatalf("expected four observations, got %#v", result.IR.Observations)
	}
	wantMetrics := map[string]bool{
		"registercustomer_capability_registercustomer_duration":   true,
		"registrations_completed":                                 true,
		"verification_failures":                                   true,
		"registercustomer_lifecycle_registercustomer_transitions": true,
	}
	for _, observation := range result.IR.Observations {
		if !wantMetrics[observation.MetricName] {
			t.Fatalf("unexpected observation metric: %#v", observation)
		}
	}
}

func TestCrossFileResolutionAndDeterministicIR(t *testing.T) {
	dir := t.TempDir()
	shared := filepath.Join(dir, "shared.dcl")
	capability := filepath.Join(dir, "capability.dcl")
	mustWrite(t, shared, "actor User is human\nshape HelloInput { name: Text required }\n")
	mustWrite(t, capability, `
capability SayHello {
  intent HelloInput from User
  outcome Greeted
  when { otherwise then Greeted }
}`)

	first := CompileFiles([]string{capability, shared})
	second := CompileFiles([]string{shared, capability})
	if HasErrors(first.Diagnostics) || HasErrors(second.Diagnostics) {
		t.Fatalf("unexpected diagnostics: first=%#v second=%#v", first.Diagnostics, second.Diagnostics)
	}
	firstJSON, _ := MarshalIR(first.IR)
	secondJSON, _ := MarshalIR(second.IR)
	if string(firstJSON) != string(secondJSON) {
		t.Fatalf("IR is not deterministic\nfirst=%s\nsecond=%s", firstJSON, secondJSON)
	}
}

func TestRemovedV01FormsAreRejected(t *testing.T) {
	for name, src := range map[string]string{
		"input": `
actor User is human
shape Input {}
capability Old { input Input from User outcome Accepted when { otherwise then Accepted } }`,
		"kind-block": `
actor User {
  kind human
}`,
		"arrow": `
actor User is human
shape Input {}
capability Old { intent Input from User outcome Accepted when { otherwise => Accepted } }`,
		"old-policy": `
policy SafeRetry is retry`,
		"applies": `
actor User is human
effect SendEmail is notify
policy SafeRetry {
  family reliability
}
shape Input {}
capability Old {
  intent Input from User
  outcome Accepted
  effect SendEmail
  policies { SafeRetry applies to effect SendEmail }
  when { otherwise then Accepted }
}`,
		"old-lifecycle": `
actor User is human
shape Input {}
capability Old {
  intent Input from User
  outcome Accepted
  when { otherwise then Accepted }
  lifecycle { begin Pending step Pending }
}`,
		"emits": `
actor User is human
shape Input {}
event AcceptedEvent is Input
capability Old {
  intent Input from User
  outcome Accepted
  when { otherwise then Accepted }
  emits { Accepted => AcceptedEvent }
}`,
	} {
		t.Run(name, func(t *testing.T) {
			result := CompileFiles([]string{writeTempDCL(t, src)})
			if !HasErrors(result.Diagnostics) {
				t.Fatalf("expected removed v0.1 syntax to fail")
			}
		})
	}
}

func TestSemanticFailures(t *testing.T) {
	src := `
actor User is human

capability Broken {
  intent MissingInput from User
  outcomes {
    Accepted
    Rejected
    Orphaned
  }
  when {
    otherwise then Accepted
    otherwise then Rejected
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_OTHERWISE_NOT_LAST")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_OTHERWISE_DUPLICATE")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_OUTCOME_CAUSE_REQUIRED")
}

func TestWhenDecisionInferenceFailures(t *testing.T) {
	src := `
actor Customer is human
effect SendVerification is notify
policy SafeRetry {
  family reliability
}
shape Input { email: Email required }
capability RegisterCustomer {
  intent Input from Customer
  outcomes { Accepted Deferred Rejected }
  effect SendVerification
  policies { SafeRetry governs MissingEffect }
  when {
    MissingRule violated then Rejected
    MissingEffect unresolved then Deferred
    UnknownPolicy denied then Accepted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_UNKNOWN_RULE")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_UNKNOWN_EFFECT_USE")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_UNKNOWN_POLICY")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_TARGET_UNKNOWN")
}

func TestV03PolicyAndObservationFailures(t *testing.T) {
	src := `
actor Customer is human
effect SendVerification is notify
policy MissingFamily {
}
policy UnknownFamily {
  family resilience
}
shape Input { email: Email required }
event CustomerRegistered is Input
capability RegisterCustomer {
  intent Input from Customer
  outcome Accepted
  effect SendVerification
  policies {
    MissingFamily governs lifecycle
    UnknownFamily governs rule TermsAccepted
    UnknownFamily governs effect MissingEffect
    UnknownFamily governs outcome MissingOutcome
    UnknownFamily governs event MissingEvent
  }
  observe {
    effect MissingEffect count as duplicate_metric
    outcome Accepted latency as duplicate_metric
    rule TermsAccepted count as rule_count
  }
  when { otherwise then Accepted }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_FAMILY_REQUIRED")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_FAMILY_UNKNOWN")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_ATTACHMENT_INVALID")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_TARGET_UNKNOWN")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_OBSERVE_TARGET_UNKNOWN")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_OBSERVE_TYPE_UNSUPPORTED")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_OBSERVE_METRIC_DUPLICATE")
}

func TestTopLevelObserveIsRejected(t *testing.T) {
	src := `
observe {
  capability duration
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if !HasErrors(result.Diagnostics) {
		t.Fatalf("expected top-level observe to fail")
	}
}

func TestLifecycleAndEffectFailures(t *testing.T) {
	src := `
actor Customer is human
effect SendVerification is notify
shape Input { email: Email required }
capability RegisterCustomer {
  intent Input from Customer
  outcomes { Accepted Deferred }
  effects {
    SendVerification after MissingEffect
    LocalEffect is notify
  }
  when {
    SendVerification unresolved then Deferred
    otherwise then Accepted
  }
  lifecycle {
    begin step Pending
    step Pending
    move Pending to Missing on outcome Deferred
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_PARSE_LOCAL_EFFECT_DECL_UNSUPPORTED")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_EFFECT_ORDER_UNKNOWN")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_UNKNOWN_EFFECT")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_UNKNOWN_STATE")
}

func assertDiagnostic(t *testing.T, diags []diagnostic.Diagnostic, code string) {
	t.Helper()
	for _, diag := range diags {
		if diag.Code == code {
			return
		}
	}
	t.Fatalf("expected diagnostic %s in %#v", code, diags)
}

func writeTempDCL(t *testing.T, src string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "input.dcl")
	mustWrite(t, path, src)
	return path
}

func mustWrite(t *testing.T, path, src string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(src), 0644); err != nil {
		t.Fatal(err)
	}
}
