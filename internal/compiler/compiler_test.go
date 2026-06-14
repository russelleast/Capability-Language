package compiler

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/ir"
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

func TestLexerCoversV04ConcernValues(t *testing.T) {
	tokens, diags := lexer.Lex("test.dcl", "timeout 30s\nlatency p95 under 500ms\nretention 7 years")
	if len(diags) != 0 {
		t.Fatalf("unexpected diagnostics: %#v", diags)
	}
	want := map[string]bool{"30s": false, "500ms": false, "7": false}
	for _, token := range tokens {
		if _, ok := want[token.Text]; ok {
			want[token.Text] = true
		}
	}
	for text, seen := range want {
		if !seen {
			t.Fatalf("expected token %q in %#v", text, tokens)
		}
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

func TestV04PolicyConcernExamplesCompileToIR(t *testing.T) {
	src := `
policy RegisterCustomerReliability {
  family reliability
  retry {
    attempts 3
    backoff exponential
  }
  timeout 30s
  idempotency required
}

policy RegisterCustomerAvailability {
  family availability
  degradation allowed
  fallback RegistrationDeferred
  dependency_tolerance required
}

policy RegisterCustomerScalability {
  family scalability
  concurrency 100
  rate_limit 1000 per minute
  queue allowed
  backpressure defer
}

policy RegisterCustomerPerformance {
  family performance
  latency p95 under 500ms
  throughput above 100 per second
  budget 1s
}

policy CustomerSecurity {
  family security
  authentication required
  authorization required
  classification confidential
  encryption required
}

policy CustomerGovernance {
  family compliance
  audit required
  retention 7 years
  approval required
  evidence required
}

policy CustomerDataProtection {
  family data_protection
  sensitivity personal
  masking required
  minimization required
  retention 2 years
  deletion required
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	if len(result.IR.Policies) != 7 {
		t.Fatalf("expected seven policies, got %#v", result.IR.Policies)
	}
	wantConcerns := map[string]int{
		"RegisterCustomerReliability":  3,
		"RegisterCustomerAvailability": 3,
		"RegisterCustomerScalability":  4,
		"RegisterCustomerPerformance":  3,
		"CustomerSecurity":             4,
		"CustomerGovernance":           4,
		"CustomerDataProtection":       5,
	}
	for _, policy := range result.IR.Policies {
		if len(policy.Concerns) != wantConcerns[policy.Name] {
			t.Fatalf("unexpected concerns for %s: %#v", policy.Name, policy.Concerns)
		}
		for _, concern := range policy.Concerns {
			if concern.Family != policy.Family {
				t.Fatalf("concern should carry policy family: %#v in %#v", concern, policy)
			}
			if concern.SourceLocation.Line == 0 {
				t.Fatalf("concern should carry source location: %#v", concern)
			}
		}
	}
}

func TestV04InlineBlockConcernParses(t *testing.T) {
	src := `
policy InlineRetry {
  family reliability
  retry { attempts 3 backoff exponential }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	concern := result.IR.Policies[0].Concerns[0]
	if len(concern.Parameters) != 2 {
		t.Fatalf("expected inline block parameters to split, got %#v", concern)
	}
}

func TestV04PolicyConcernSemanticFailures(t *testing.T) {
	src := `
policy UnknownConcern {
  family reliability
  hedging allowed
}

policy WrongFamily {
  family security
  timeout 30s
}

policy InvalidValues {
  family scalability
  concurrency 0
  rate_limit 0 per minute
}

policy Conflicting {
  family availability
  queue allowed
  queue forbidden
}

policy UnsupportedParam {
  family reliability
  retry {
    attempts 3
    window 1m
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_UNKNOWN")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_WRONG_FAMILY")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_VALUE_INVALID")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_CONFLICT")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_UNSUPPORTED")
}

func TestV04BackoffRequiresRetry(t *testing.T) {
	src := `
policy BadRetry {
  family reliability
  backoff exponential
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_PARAM_REQUIRED")
	assertDiagnosticMessage(t, result.Diagnostics, "backoff requires retry")
}

func TestV04CircuitBreakerProtectsOnlyEffects(t *testing.T) {
	src := `
actor Customer is human
effect CallPaymentGateway is request
shape Input { email: Email required }

policy PaymentDependencyProtection {
  family reliability
  circuit_breaker {
    opens after 5 failures
    resets after 30s
  }
}

capability RegisterCustomer {
  intent Input from Customer
  outcomes { Accepted Deferred }
  effect CallPaymentGateway
  policies {
    PaymentDependencyProtection governs effect CallPaymentGateway
  }
  when {
    CallPaymentGateway unresolved then Deferred
    otherwise then Accepted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	policy := result.IR.Policies[0]
	if len(policy.Concerns) != 1 || policy.Concerns[0].Name != "circuit_breaker" {
		t.Fatalf("expected circuit_breaker concern in IR: %#v", policy)
	}
	if len(policy.AttachmentPoints) != 1 || policy.AttachmentPoints[0].TargetKind != "effect" {
		t.Fatalf("expected effect attachment in policy IR: %#v", policy.AttachmentPoints)
	}
}

func TestV04CircuitBreakerAttachmentAndParameterFailures(t *testing.T) {
	src := `
actor Customer is human
effect CallPaymentGateway is request
shape Input {}

policy BadCircuitTarget {
  family reliability
  circuit_breaker {
    opens after 5 failures
    resets after 30s
  }
}

policy BadCircuitParams {
  family reliability
  circuit_breaker {
    opens after 0 failures
  }
}

policy WrongCircuitFamily {
  family availability
  circuit_breaker {
    opens after 5 failures
    resets after 30s
  }
}

capability RegisterCustomer {
  intent Input from Customer
  outcomes { Accepted Deferred }
  effect CallPaymentGateway
  policies {
    BadCircuitTarget governs capability
    BadCircuitParams governs effect CallPaymentGateway
  }
  when {
    CallPaymentGateway unresolved then Deferred
    otherwise then Accepted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_ATTACHMENT_INVALID")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_PARAM_REQUIRED")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_WRONG_FAMILY")
}

func TestV04FallbackOutcomeResolution(t *testing.T) {
	src := `
actor Customer is human
shape Input {}

policy Availability {
  family availability
  degradation allowed
  fallback MissingOutcome
}

capability RegisterCustomer {
  intent Input from Customer
  outcome Accepted
  policies {
    Availability governs capability
  }
  when {
    otherwise then Accepted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_FALLBACK_OUTCOME_UNKNOWN")
}

func TestV05EffectivePolicyEnvelopeNarrowsAndDerivesObligations(t *testing.T) {
	src := `
actor Customer is human
effect CallPaymentGateway is request
shape Input { email: Email required }

policy CapabilityReliability {
  family reliability
  timeout 30s
  idempotency allowed
}

policy PaymentReliability {
  family reliability
  timeout 5s
  retry { attempts 3 }
}

capability RegisterCustomer {
  intent Input from Customer
  outcomes { Accepted PaymentDeferred }
  effect CallPaymentGateway
  policies {
    CapabilityReliability governs capability
    PaymentReliability governs effect CallPaymentGateway
  }
  when {
    policy PaymentReliability exhausted then PaymentDeferred
    otherwise then Accepted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	effect := findEffectivePolicy(t, result.IR.EffectivePolicies, "effect", "CallPaymentGateway")
	timeout := findEffectiveConcern(t, effect.EffectiveConcerns, "timeout")
	if timeout.CompositionMode != "narrow" || scalarParameterValue(timeout.EffectiveParameters) != "5s" {
		t.Fatalf("expected narrowed effect timeout, got %#v", timeout)
	}
	retry := findEffectiveConcern(t, effect.EffectiveConcerns, "retry")
	if retry.CompositionMode != "target-local" {
		t.Fatalf("expected target-local retry, got %#v", retry)
	}
	if len(effect.Obligations) == 0 {
		t.Fatalf("expected derived policy obligations in effect envelope")
	}
	if len(effect.Causations) != 1 || effect.Causations[0].State != "exhausted" || effect.Causations[0].Outcome != "PaymentDeferred" {
		t.Fatalf("expected retry exhaustion policy causation, got %#v", effect.Causations)
	}
	if len(timeout.Overrides) != 0 {
		t.Fatalf("v0.5 must not populate override semantics: %#v", timeout.Overrides)
	}
}

func TestV05PolicyNarrowingViolation(t *testing.T) {
	src := `
actor Customer is human
effect CallPaymentGateway is request
shape Input {}

policy CapabilityReliability {
  family reliability
  timeout 30s
}

policy SlowPaymentReliability {
  family reliability
  timeout 60s
}

capability RegisterCustomer {
  intent Input from Customer
  outcomes { Accepted Deferred }
  effect CallPaymentGateway
  policies {
    CapabilityReliability governs capability
    SlowPaymentReliability governs effect CallPaymentGateway
  }
  when {
    CallPaymentGateway unresolved then Deferred
    otherwise then Accepted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_NARROWING_VIOLATION")
}

func TestV05PolicyWeakenedGuarantee(t *testing.T) {
	src := `
actor Customer is human
effect SendVerification is notify
shape Input {}

policy RequiredIdempotency {
  family reliability
  idempotency required
}

policy WeakenedIdempotency {
  family reliability
  idempotency allowed
}

capability RegisterCustomer {
  intent Input from Customer
  outcomes { Accepted Deferred }
  effect SendVerification
  policies {
    RequiredIdempotency governs capability
    WeakenedIdempotency governs effect SendVerification
  }
  when {
    SendVerification unresolved then Deferred
    otherwise then Accepted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_WEAKENED_GUARANTEE")
}

func TestV05RetryRequiresIdempotency(t *testing.T) {
	src := `
actor Customer is human
effect SendVerification is notify
shape Input {}

policy RetryEmail {
  family reliability
  retry { attempts 3 }
}

capability RegisterCustomer {
  intent Input from Customer
  outcomes { Accepted Deferred }
  effect SendVerification
  policies {
    RetryEmail governs effect SendVerification
  }
  when {
    policy RetryEmail exhausted then Deferred
    otherwise then Accepted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_RETRY_REQUIRES_IDEMPOTENCY")
}

func TestV05PolicyCausationRequiresMatchingConcern(t *testing.T) {
	src := `
actor Customer is human
shape Input {}

policy CustomerSecurity {
  family security
  authorization required
}

capability RegisterCustomer {
  intent Input from Customer
  outcomes { Accepted Deferred }
  policies {
    CustomerSecurity governs capability
  }
  when {
    policy CustomerSecurity exhausted then Deferred
    otherwise then Accepted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CAUSATION_CONCERN_MISSING")
}

func TestV05ConcernStrengthOrdering(t *testing.T) {
	required := []ir.ConcernParameterIR{{Name: "value", Values: []string{"required"}}}
	allowed := []ir.ConcernParameterIR{{Name: "value", Values: []string{"allowed"}}}
	if got := compareConcernStrength("idempotency", allowed, required); got != strengthStronger {
		t.Fatalf("required should strengthen allowed, got %s", got)
	}
	if got := compareConcernStrength("idempotency", required, allowed); got != strengthWeaker {
		t.Fatalf("allowed should weaken required, got %s", got)
	}
	public := []ir.ConcernParameterIR{{Name: "value", Values: []string{"public"}}}
	restricted := []ir.ConcernParameterIR{{Name: "value", Values: []string{"restricted"}}}
	if got := compareConcernStrength("classification", public, restricted); got != strengthStronger {
		t.Fatalf("restricted should strengthen public, got %s", got)
	}
	parentRate := []ir.ConcernParameterIR{{Name: "value", Values: []string{"1000", "per", "minute"}}}
	childRate := []ir.ConcernParameterIR{{Name: "value", Values: []string{"10", "per", "second"}}}
	if got := compareConcernStrength("rate_limit", parentRate, childRate); got != strengthIncomparable {
		t.Fatalf("different rate units should be incomparable, got %s", got)
	}
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

func TestV06ContextDependencyResolutionAndIR(t *testing.T) {
	dir := t.TempDir()
	shared := filepath.Join(dir, "shared.dcl")
	customer := filepath.Join(dir, "customer.dcl")
	mustWrite(t, shared, `
context Shared.Types

shape RegisterCustomerInput {
  email: Text required
}`)
	mustWrite(t, customer, `
context Customer.Registration

depends on Shared.Types

actor Customer is human

capability RegisterCustomer {
  intent RegisterCustomerInput from Customer
  outcome Registered
  when { otherwise then Registered }
}`)

	first := CompileFiles([]string{customer, shared})
	second := CompileFiles([]string{shared, customer})
	if HasErrors(first.Diagnostics) || HasErrors(second.Diagnostics) {
		t.Fatalf("unexpected diagnostics: first=%#v second=%#v", first.Diagnostics, second.Diagnostics)
	}
	assertContextIR(t, first.IR.Contexts, "Customer.Registration")
	assertContextIR(t, first.IR.Contexts, "Shared.Types")
	assertSymbolFQN(t, first.IR.Symbols, "shape", "Shared.Types.RegisterCustomerInput", "public")
	assertDependencyIR(t, first.IR.Dependencies, "Customer.Registration", "Shared.Types", "Shared.Types.RegisterCustomerInput")
	firstJSON, _ := MarshalIR(first.IR)
	secondJSON, _ := MarshalIR(second.IR)
	if string(firstJSON) != string(secondJSON) {
		t.Fatalf("IR is not deterministic\nfirst=%s\nsecond=%s", firstJSON, secondJSON)
	}
}

func TestV06PrivateSymbolsAreVisibleOnlyInsideOwningContext(t *testing.T) {
	src := `
context Shared.Types

private shape InternalInput {
  value: Text required
}

actor InternalActor is human

capability InternalUse {
  intent InternalInput from InternalActor
  outcome Accepted
  when { otherwise then Accepted }
}

context Customer.Registration

depends on Shared.Types

actor Customer is human

capability RegisterCustomer {
  intent InternalInput from Customer
  outcome Registered
  when { otherwise then Registered }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_SYMBOL_IS_PRIVATE")
	assertSymbolFQN(t, result.IR.Symbols, "shape", "Shared.Types.InternalInput", "private")
}

func TestV06MissingDependencyAndNonTransitiveVisibility(t *testing.T) {
	src := `
context Shared.Types
shape Input { value: Text required }

context Shared.More
depends on Shared.Types
shape Wrapper { value: Input required }

context Customer.Registration
actor Customer is human
capability RegisterCustomer {
  intent Input from Customer
  outcome Registered
  when { otherwise then Registered }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_UNDEFINED_SYMBOL")
}

func TestV06AmbiguousSymbolAndFullyQualifiedDisambiguation(t *testing.T) {
	ambiguous := `
context Shared.A
shape Input { value: Text required }

context Shared.B
shape Input { value: Text required }

context Customer.Registration
depends on Shared.A
depends on Shared.B
actor Customer is human
capability RegisterCustomer {
  intent Input from Customer
  outcome Registered
  when { otherwise then Registered }
}`
	result := CompileFiles([]string{writeTempDCL(t, ambiguous)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_AMBIGUOUS_SYMBOL")

	disambiguated := strings.Replace(ambiguous, "intent Input from Customer", "intent Shared.A.Input from Customer", 1)
	result = CompileFiles([]string{writeTempDCL(t, disambiguated)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
}

func TestV06NestedContextBlocksNormalizeToQualifiedContext(t *testing.T) {
	src := `
context Shared {
  context Types {
    shape Input { value: Text required }
  }
}

context Customer {
  context Registration {
    depends on Shared.Types
    actor Customer is human
    capability RegisterCustomer {
      intent Input from Customer
      outcome Registered
      when { otherwise then Registered }
    }
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	assertContextIR(t, result.IR.Contexts, "Customer.Registration")
	assertContextIR(t, result.IR.Contexts, "Shared.Types")
	assertDependencyIR(t, result.IR.Dependencies, "Customer.Registration", "Shared.Types", "Shared.Types.Input")
}

func TestV06DependencyCycleUndefinedContextDuplicateAndUnused(t *testing.T) {
	src := `
context A
depends on B
shape Input { value: Text required }
shape Input { other: Text required }

context B
depends on A
shape BInput { value: Text required }

context C
depends on Missing.Context

context D
depends on B
shape Local { value: Text required }`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_DEPENDENCY_CYCLE")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_UNDEFINED_CONTEXT")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_DUPLICATE_SYMBOL")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_UNUSED_DEPENDENCY")
}

func TestV07ValidSupervisedLifecycle(t *testing.T) {
	src := v07OrderFulfilmentSource(`
  supervises lifecycle FulfilmentLifecycle {
    identity orderId
    contributors {
      AcceptOrder
      AuthorisePayment
      PickOrder
      DispatchOrder
    }

    begin step Received
    step PaymentPending
    step Picking
    step Dispatching
    end step Completed
    end step Failed

    move Received to PaymentPending on outcome OrderAccepted from AcceptOrder
    move PaymentPending to Picking on outcome PaymentAuthorised from AuthorisePayment
    move PaymentPending to Failed on outcome PaymentDeclined from AuthorisePayment
    move Picking to Dispatching on outcome Picked from PickOrder
    move Dispatching to Completed on outcome Dispatched from DispatchOrder
  }`)
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	cap := findCapability(t, result.IR.Capabilities, "OrderFulfilment")
	if cap.Lifecycle == nil {
		t.Fatalf("expected supervised lifecycle in IR")
	}
	lifecycle := cap.Lifecycle
	if lifecycle.Name != "FulfilmentLifecycle" || lifecycle.OwnerCapability != "OrderFulfilment" || lifecycle.IdentityBinding != "orderId" {
		t.Fatalf("unexpected lifecycle metadata: %#v", lifecycle)
	}
	for _, participant := range []string{"AcceptOrder", "AuthorisePayment", "OrderFulfilment"} {
		if !contains(lifecycle.ParticipatingCapabilities, participant) {
			t.Fatalf("expected lifecycle participant %s in %#v", participant, lifecycle.ParticipatingCapabilities)
		}
	}
	var authorised ir.TransitionIR
	for _, transition := range lifecycle.Transitions {
		if transition.SourceSymbol == "PaymentAuthorised" {
			authorised = transition
		}
	}
	if authorised.SourceCapability != "AuthorisePayment" || authorised.SourceKind != "outcome" || authorised.CorrelationBinding != "orderId" {
		t.Fatalf("unexpected transition IR: %#v", authorised)
	}
}

func TestV07DuplicateLifecycleOwnershipRejected(t *testing.T) {
	src := v07OrderFulfilmentSource(`
  supervises lifecycle FulfilmentLifecycle {
    identity orderId
    begin step Received
    end step Completed
    move Received to Completed on outcome OrderAccepted from AcceptOrder
  }`) + `

capability FulfilmentReporting {
  intent OrderInput from Customer
  outcome ReportingReady
  when { otherwise then ReportingReady }
  supervises lifecycle FulfilmentLifecycle {
    identity orderId
    begin step Started
    end step Done
    move Started to Done on outcome OrderAccepted from AcceptOrder
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_MULTIPLE_OWNERS")
}

func TestV07MissingTransitionSourceCapabilityRejected(t *testing.T) {
	src := v07OrderFulfilmentSource(`
  supervises lifecycle FulfilmentLifecycle {
    identity orderId
    begin step Received
    end step PaymentPending
    move Received to PaymentPending on outcome OrderAccepted from MissingCapability
  }`)
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_UNDEFINED_TRANSITION_SOURCE_CAPABILITY")
}

func TestV07MissingTransitionSourceOutcomeRejected(t *testing.T) {
	src := v07OrderFulfilmentSource(`
  supervises lifecycle FulfilmentLifecycle {
    identity orderId
    begin step Received
    end step PaymentPending
    move Received to PaymentPending on outcome MissingOutcome from AcceptOrder
  }`)
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_UNDEFINED_TRANSITION_SOURCE_SYMBOL")
}

func TestV07CrossCapabilityTransitionRequiresIdentity(t *testing.T) {
	src := v07OrderFulfilmentSource(`
  supervises lifecycle FulfilmentLifecycle {
    begin step Received
    end step PaymentPending
    move Received to PaymentPending on outcome OrderAccepted from AcceptOrder
  }`)
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_UNCORRELATED_TRANSITION_SOURCE")
}

func TestV07AmbiguousLifecycleTransitionRejected(t *testing.T) {
	src := v07OrderFulfilmentSource(`
  supervises lifecycle FulfilmentLifecycle {
    identity orderId
    begin step Received
    step PaymentPending
    end step Failed
    move Received to PaymentPending on outcome OrderAccepted from AcceptOrder
    move Received to Failed on outcome OrderAccepted from AcceptOrder
  }`)
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_AMBIGUOUS_LIFECYCLE_TRANSITION")
}

func TestV07OrdinaryLocalLifecycleAndLocalEventStillCompile(t *testing.T) {
	src := `
actor Customer is human
shape Input { orderId: Text required }
event OrderCompleted is Input

capability CompleteOrder {
  intent Input from Customer
  outcome Completed
  when { otherwise then Completed }
  lifecycle {
    begin step Pending
    end step Done
    move Pending to Done on event OrderCompleted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
}

func TestV08LifecycleCompletionSemantics(t *testing.T) {
	src := `
actor Customer is human
shape OrderInput { orderId: Text required }
event PaymentReceived is OrderInput

capability CheckInventory {
  intent OrderInput from Customer
  outcome InventoryReserved
  when { otherwise then InventoryReserved }
}

capability CapturePayment {
  intent OrderInput from Customer
  outcome PaymentCaptured
  when { otherwise then PaymentCaptured }
}

capability ShipOrder {
  intent OrderInput from Customer
  outcomes { OrderShipped ShippingFailed }
  rule ShippingPossible: input.orderId is present
  when {
    ShippingPossible violated then ShippingFailed
    otherwise then OrderShipped
  }
}

capability RefundPayment {
  intent OrderInput from Customer
  outcome RecoveryFailed
  when { otherwise then RecoveryFailed }
}

capability OrderFulfilment {
  intent OrderInput from Customer
  outcomes { FulfilmentSupervised PaymentExpired }
  when { otherwise then FulfilmentSupervised }

  supervises lifecycle OrderLifecycle {
    identity orderId

    contributors {
      CheckInventory
      CapturePayment
      ShipOrder
      RefundPayment
    }

    begin Pending

    step Pending {
      kind active
    }

    step AwaitingPayment {
      kind waiting
      waits for event PaymentReceived from CapturePayment
      deadline 15 minutes causing outcome PaymentExpired
    }

    step PaymentCaptured {
      kind active
      recovery RefundPayment
    }

    step RecoveringPayment {
      kind recovery
    }

    end Completed
    end Expired
    end Failed

    move Pending to AwaitingPayment on outcome InventoryReserved from CheckInventory
    move AwaitingPayment to PaymentCaptured on event PaymentReceived
    move AwaitingPayment to Expired on outcome PaymentExpired
    move PaymentCaptured to Completed on outcome OrderShipped from ShipOrder
    move PaymentCaptured to RecoveringPayment on outcome ShippingFailed from ShipOrder
    move RecoveringPayment to Failed on outcome RecoveryFailed from RefundPayment
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED")
	cap := findCapability(t, result.IR.Capabilities, "OrderFulfilment")
	lifecycle := cap.Lifecycle
	if lifecycle == nil {
		t.Fatalf("expected lifecycle IR")
	}
	if len(lifecycle.Contributors) != 4 {
		t.Fatalf("expected contributors in IR: %#v", lifecycle.Contributors)
	}
	awaiting := findLifecycleStep(t, lifecycle.Steps, "AwaitingPayment")
	if awaiting.Kind != "waiting" || len(awaiting.WaitingTriggers) != 1 || len(awaiting.Deadlines) != 1 {
		t.Fatalf("unexpected waiting step IR: %#v", awaiting)
	}
	if awaiting.Deadlines[0].ConsequenceSymbol != "PaymentExpired" {
		t.Fatalf("expected deadline consequence in IR: %#v", awaiting.Deadlines[0])
	}
	paymentCaptured := findLifecycleStep(t, lifecycle.Steps, "PaymentCaptured")
	if len(paymentCaptured.RecoveryActions) != 1 || paymentCaptured.RecoveryActions[0].Target != "RefundPayment" {
		t.Fatalf("expected recovery action in IR: %#v", paymentCaptured)
	}
	if len(paymentCaptured.RecoveryActions[0].ResultOutcomes) != 1 || paymentCaptured.RecoveryActions[0].ResultOutcomes[0] != "RecoveryFailed" {
		t.Fatalf("expected recovery result outcome from explicit transition: %#v", paymentCaptured.RecoveryActions[0])
	}
	refund := findContributor(t, lifecycle.Contributors, "RefundPayment")
	if len(refund.UsedByRecovery) != 1 || refund.UsedByRecovery[0] != "PaymentCaptured" {
		t.Fatalf("expected recovery contributor usage: %#v", refund)
	}
}

func TestV08MultipleWaitsAndLegacyStepSyntax(t *testing.T) {
	src := `
actor Customer is human
shape Input { value: Text required }

capability VerifyCustomer {
  intent Input from Customer
  outcomes { CustomerVerified VerificationCancelled }
  rule CanVerify: input.value is present
  when {
    CanVerify violated then VerificationCancelled
    otherwise then CustomerVerified
  }
}

capability RegisterCustomer {
  intent Input from Customer
  outcome Registered
  when { otherwise then Registered }
  supervises lifecycle CustomerLifecycle {
    identity value
    contributors { VerifyCustomer }
    begin step Pending
    step Pending {
      kind waiting
      waits for outcome CustomerVerified from VerifyCustomer
      waits for outcome VerificationCancelled from VerifyCustomer
    }
    end step Done
    end step Cancelled
    move Pending to Done on outcome CustomerVerified from VerifyCustomer
    move Pending to Cancelled on outcome VerificationCancelled from VerifyCustomer
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	step := findLifecycleStep(t, findCapability(t, result.IR.Capabilities, "RegisterCustomer").Lifecycle.Steps, "Pending")
	if len(step.WaitingTriggers) != 2 {
		t.Fatalf("expected multiple wait triggers: %#v", step)
	}
}

func TestV08LifecycleCompletionFailures(t *testing.T) {
	src := `
actor Customer is human
shape Input { value: Text required }
event ExistingEvent is Input

capability CapturePayment {
  intent Input from Customer
  outcome Captured
  when { otherwise then Captured }
}

capability RefundPayment {
  intent Input from Customer
  outcome Recovered
  when { otherwise then Recovered }
}

capability BrokenLifecycle {
  intent Input from Customer
  outcomes { Accepted Expired }
  when { otherwise then Accepted }
  supervises lifecycle Broken {
    identity value
    contributors {
      MissingContributor
      RefundPayment
      CapturePayment
    }
    begin Start
    step Start {
      kind strange
      deadline 0 minutes causing outcome MissingOutcome
      deadline 1 minute causing outcome Expired
      recovery MissingRecovery
    }
    step Waiting {
      kind waiting
    }
    step EventWaiting {
      kind waiting
      waits for event MissingEvent from CapturePayment
      waits for outcome Captured from NonContributor
    }
    step Recovering {
      kind recovery
      recovery RefundPayment
    }
    move Start to Waiting on outcome Accepted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_UNKNOWN_CAPABILITY")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_STEP_KIND_INVALID")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_DEADLINE_DURATION_INVALID")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_DEADLINE_CONSEQUENCE_UNKNOWN")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_DEADLINE_CONFLICT")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_RECOVERY_TARGET_UNKNOWN")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_WAIT_MISSING")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_WAIT_NO_EXIT")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_UNKNOWN_EVENT")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_NON_CONTRIBUTOR")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_RECOVERY_RESULT_TRANSITION_MISSING")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_CONTRIBUTOR_UNUSED")
}

func TestV08InvalidRecoveryLoop(t *testing.T) {
	src := `
actor Customer is human
shape Input { value: Text required }

capability RefundPayment {
  intent Input from Customer
  outcomes { Recovered TryAgain }
  rule CanRecover: input.value is present
  when {
    CanRecover violated then TryAgain
    otherwise then Recovered
  }
}

capability BrokenRecoveryLoop {
  intent Input from Customer
  outcome Accepted
  when { otherwise then Accepted }
  supervises lifecycle RecoveryLoop {
    identity value
    contributors { RefundPayment }
    begin Recovering
    step Recovering {
      kind recovery
      recovery RefundPayment
    }
    step Retrying
    move Recovering to Retrying on outcome Recovered from RefundPayment
    move Retrying to Recovering on outcome TryAgain from RefundPayment
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_RECOVERY_LOOP_INVALID")
}

func TestV09SyntaxAndAuthoringImprovementsCompileToIR(t *testing.T) {
	src := `
actor Customer is human
actor Manager is human

effect PublishInvoice is notify
effect PersistInvoice is persistence
effect ChargeCard is invocation

shape PaymentInput {
  paymentId: Uuid required
  email: Email required
  amount: Money required
  contacts: List<Email>
}

event PaymentReceived is PaymentInput

capability CollectPayment {
  intent PaymentInput from Customer

  actors {
    approver: Manager
  }

  outcomes {
    VerificationStarted
  }

  events {
    emits PaymentReceived
  }

  when {
    always then VerificationStarted
  }

  lifecycle {
    contributors {
      CollectPayment
    }

    begin Submitted
    step AwaitingPayment waits for event PaymentReceived
    step AwaitingApproval requires decision from approver
    end Approved

    move Submitted to AwaitingPayment on outcome VerificationStarted
    move AwaitingPayment to AwaitingApproval on event PaymentReceived
    move AwaitingApproval to Approved on outcome VerificationStarted
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_SELF_CONTRIBUTOR_REDUNDANT")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_EFFECT_KIND_LEGACY")

	cap := findCapability(t, result.IR.Capabilities, "CollectPayment")
	if len(cap.EmittedEvents) != 1 || cap.EmittedEvents[0].Event != "PaymentReceived" || cap.EmittedEvents[0].Source != "CollectPayment" {
		t.Fatalf("expected emitted event in capability IR: %#v", cap.EmittedEvents)
	}
	if len(cap.Analysis.OutcomeCauses) != 1 || cap.Analysis.OutcomeCauses[0].Condition != "always" {
		t.Fatalf("expected always causation in IR: %#v", cap.Analysis.OutcomeCauses)
	}
	awaitingPayment := findLifecycleStep(t, cap.Lifecycle.Steps, "AwaitingPayment")
	if awaitingPayment.Kind != "waiting" || awaitingPayment.WaitingTriggers[0].SourceCapability != "CollectPayment" {
		t.Fatalf("expected owner-inferred waiting step: %#v", awaitingPayment)
	}
	awaitingApproval := findLifecycleStep(t, cap.Lifecycle.Steps, "AwaitingApproval")
	if awaitingApproval.Kind != "decision" || awaitingApproval.DecisionActor != "Manager" || awaitingApproval.DecisionRole != "approver" {
		t.Fatalf("expected role-backed decision step: %#v", awaitingApproval)
	}
	if len(cap.Lifecycle.Contributors) != 0 {
		t.Fatalf("explicit local self contributor should be normalized away: %#v", cap.Lifecycle.Contributors)
	}
	assertEffectType(t, result.IR.Effects, "PublishInvoice", "notification")
	assertEffectType(t, result.IR.Effects, "PersistInvoice", "persistence")
	assertEffectType(t, result.IR.Effects, "ChargeCard", "invocation")
}

func TestV09EventOwnershipWarningsAndFailures(t *testing.T) {
	src := `
actor Customer is human
shape Input { value: Text required }
event KnownEvent is Input

capability Source {
  intent Input from Customer
  outcome Done
  events {
    emits KnownEvent
    emits KnownEvent
    emits MissingEvent
  }
  when { always then Done }
}

capability Watch {
  intent Input from Customer
  outcome Started
  when { always then Started }
  supervises lifecycle WatchLifecycle {
    identity value
    contributors { Source }
    begin Waiting
    step Waiting waits for event KnownEvent
    end Complete
    move Waiting to Complete on event KnownEvent from Source
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_CAPABILITY_EVENT_DUPLICATE")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_CAPABILITY_EVENT_UNKNOWN")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_WAIT_SOURCE_REQUIRED")
}

func TestV09UnprovenEventSourceOwnershipWarns(t *testing.T) {
	src := `
actor Customer is human
shape Input { value: Text required }
event PaymentReceived is Input

capability CollectPayment {
  intent Input from Customer
  outcome Started
  when { always then Started }
  lifecycle {
    begin Pending
    step Pending waits for event PaymentReceived
    end Done
    move Pending to Done on outcome Started
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_EVENT_SOURCE_UNDECLARED")
}

func TestV09DecisionProviderAmbiguityAndUnknownProvider(t *testing.T) {
	ambiguous := `
actor Customer is human
actor Manager is human
actor approver is human
shape Input { value: Text required }

capability ApproveRequest {
  intent Input from Customer
  actors { approver: Manager }
  outcome Started
  when { always then Started }
  lifecycle {
    begin Pending
    step Pending requires decision from approver
    end Done
    move Pending to Done on outcome Started
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, ambiguous)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_DECISION_PROVIDER_AMBIGUOUS")

	unknown := strings.Replace(ambiguous, "from approver", "from Reviewer", 1)
	result = CompileFiles([]string{writeTempDCL(t, unknown)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_LIFECYCLE_DECISION_PROVIDER_UNKNOWN")
}

func TestV09AlwaysAndBuiltinShadowingFailures(t *testing.T) {
	src := `
actor Customer is human
shape Email { value: Text required }
shape Input { email: Email required }

capability Broken {
  intent Input from Customer
  outcomes { Accepted Rejected }
  when {
    always then Accepted
    otherwise then Rejected
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_TYPE_BUILTIN_SHADOWED")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_ALWAYS_WITH_OTHER_BRANCHES")
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

func v07OrderFulfilmentSource(lifecycle string) string {
	return `
actor Customer is human

shape OrderInput {
  orderId: Text required
}

capability AcceptOrder {
  intent OrderInput from Customer
  outcome OrderAccepted
  when { otherwise then OrderAccepted }
}

capability AuthorisePayment {
  intent OrderInput from Customer
  outcomes {
    PaymentAuthorised
    PaymentDeclined
  }
  rule PaymentDetailsPresent: input.orderId is present
  when {
    PaymentDetailsPresent violated then PaymentDeclined
    otherwise then PaymentAuthorised
  }
}

capability PickOrder {
  intent OrderInput from Customer
  outcome Picked
  when { otherwise then Picked }
}

capability DispatchOrder {
  intent OrderInput from Customer
  outcome Dispatched
  when { otherwise then Dispatched }
}

capability OrderFulfilment {
  intent OrderInput from Customer
  outcome FulfilmentSupervised
  when { otherwise then FulfilmentSupervised }
` + lifecycle + `
}`
}

func findCapability(t *testing.T, capabilities []ir.CapabilityIR, name string) ir.CapabilityIR {
	t.Helper()
	for _, capability := range capabilities {
		if capability.Name == name {
			return capability
		}
	}
	t.Fatalf("expected capability %s in %#v", name, capabilities)
	return ir.CapabilityIR{}
}

func findLifecycleStep(t *testing.T, steps []ir.LifecycleStepIR, name string) ir.LifecycleStepIR {
	t.Helper()
	for _, step := range steps {
		if step.Name == name {
			return step
		}
	}
	t.Fatalf("expected lifecycle step %s in %#v", name, steps)
	return ir.LifecycleStepIR{}
}

func findContributor(t *testing.T, contributors []ir.ContributorIR, capability string) ir.ContributorIR {
	t.Helper()
	for _, contributor := range contributors {
		if contributor.Capability == capability {
			return contributor
		}
	}
	t.Fatalf("expected contributor %s in %#v", capability, contributors)
	return ir.ContributorIR{}
}

func assertEffectType(t *testing.T, effects []ir.EffectIR, name, effectType string) {
	t.Helper()
	for _, effect := range effects {
		if effect.Name == name {
			if effect.Type != effectType {
				t.Fatalf("expected effect %s type %s, got %#v", name, effectType, effect)
			}
			return
		}
	}
	t.Fatalf("expected effect %s in %#v", name, effects)
}

func assertDiagnosticMessage(t *testing.T, diags []diagnostic.Diagnostic, message string) {
	t.Helper()
	for _, diag := range diags {
		if diag.Message == message {
			return
		}
	}
	t.Fatalf("expected diagnostic message %q in %#v", message, diags)
}

func assertContextIR(t *testing.T, contexts []ir.ContextIR, name string) {
	t.Helper()
	for _, ctx := range contexts {
		if ctx.Name == name {
			return
		}
	}
	t.Fatalf("expected context %s in %#v", name, contexts)
}

func assertSymbolFQN(t *testing.T, symbols []ir.SymbolIR, kind, fqn, visibility string) {
	t.Helper()
	for _, symbol := range symbols {
		if symbol.Kind == kind && symbol.FullyQualifiedName == fqn {
			if symbol.Visibility != visibility {
				t.Fatalf("expected %s visibility for %#v", visibility, symbol)
			}
			return
		}
	}
	t.Fatalf("expected symbol %s %s in %#v", kind, fqn, symbols)
}

func assertDependencyIR(t *testing.T, deps []ir.DependencyIR, source, target, referenced string) {
	t.Helper()
	for _, dep := range deps {
		if dep.SourceContext == source && dep.TargetContext == target {
			for _, ref := range dep.ReferencedSymbols {
				if ref == referenced {
					return
				}
			}
			t.Fatalf("expected dependency %s -> %s to reference %s in %#v", source, target, referenced, dep)
		}
	}
	t.Fatalf("expected dependency %s -> %s in %#v", source, target, deps)
}

func findEffectivePolicy(t *testing.T, policies []ir.EffectivePolicyIR, targetKind, targetSymbol string) ir.EffectivePolicyIR {
	t.Helper()
	for _, policy := range policies {
		if policy.TargetKind == targetKind && policy.TargetSymbol == targetSymbol {
			return policy
		}
	}
	t.Fatalf("expected effective policy for %s %s in %#v", targetKind, targetSymbol, policies)
	return ir.EffectivePolicyIR{}
}

func findEffectiveConcern(t *testing.T, concerns []ir.EffectiveConcernIR, name string) ir.EffectiveConcernIR {
	t.Helper()
	for _, concern := range concerns {
		if concern.Name == name {
			return concern
		}
	}
	t.Fatalf("expected effective concern %s in %#v", name, concerns)
	return ir.EffectiveConcernIR{}
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
