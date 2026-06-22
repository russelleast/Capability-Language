package compiler

import (
	"testing"

	"capabilitylanguage/internal/ir"
)

func TestPolicyConcernExamplesCompileToIR(t *testing.T) {
	src := `
policy RegisterCustomerReliability {
  reliability {
    retry {
      attempts 3
      backoff exponential
    }
    timeout 30s
    idempotency required
  }
}

policy RegisterCustomerAvailability {
  availability {
    degradation allowed
    fallback RegistrationDeferred
    dependency_tolerance required
  }
}

policy RegisterCustomerScalability {
  scalability {
    concurrency 100
    rate_limit 1000 per minute
    queue allowed
    backpressure defer
  }
}

policy RegisterCustomerPerformance {
  performance {
    latency p95 under 500ms
    throughput above 100 per second
    budget 1s
  }
}

policy CustomerSecurity {
  security {
    authentication required
    authorization required
    classification confidential
    encryption required
  }
}

policy CustomerGovernance {
  compliance {
    audit required
    retention 7 years
    approval required
    evidence required
  }
}

policy CustomerDataProtection {
  data_protection {
    sensitivity personal
    masking required
    minimization required
    retention 2 years
    deletion required
  }
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

func TestAgenticVocabularyCompilesToIR(t *testing.T) {
	src := `
actor SupportAgent is agent
effect SearchKnowledgeBase is tool
shape CustomerQuestion { question: Text required }

policy MinimumAnswerConfidence {
  confidence {
    threshold 0.8
  }
}

capability AnswerCustomerQuestion {
  intent CustomerQuestion from SupportAgent
  outcomes { AnswerPrepared InsufficientConfidence ToolUnavailable }
  effect SearchKnowledgeBase
  policies {
    MinimumAnswerConfidence applies to outcome AnswerPrepared
  }
  when {
    SearchKnowledgeBase failed then ToolUnavailable
    policy MinimumAnswerConfidence fails then InsufficientConfidence
    otherwise then AnswerPrepared
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	if result.IR.Actors[0].Classification != "agent" {
		t.Fatalf("expected actor kind agent, got %#v", result.IR.Actors[0])
	}
	if result.IR.Effects[0].Type != "tool" {
		t.Fatalf("expected effect kind tool, got %#v", result.IR.Effects[0])
	}
	policy := result.IR.Policies[0]
	if policy.Kind != "confidence" || policy.Threshold == nil || *policy.Threshold != 0.8 {
		t.Fatalf("expected confidence policy threshold in IR, got %#v", policy)
	}
}

func TestConfidenceThresholdValidation(t *testing.T) {
	for name, threshold := range map[string]string{
		"zero":       "0",
		"one":        "1",
		"fractional": "0.8",
	} {
		t.Run(name, func(t *testing.T) {
			src := `
policy MinimumAnswerConfidence {
  confidence {
    threshold ` + threshold + `
  }
}`
			result := CompileFiles([]string{writeTempDCL(t, src)})
			if HasErrors(result.Diagnostics) {
				t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
			}
		})
	}

	for name, tc := range map[string]struct {
		body string
		code string
	}{
		"missing":     {"", "DCL_SEM_CONFIDENCE_THRESHOLD_REQUIRED"},
		"non-numeric": {"threshold high", "DCL_SEM_CONFIDENCE_THRESHOLD_NOT_NUMERIC"},
		"below":       {"threshold -0.1", "DCL_SEM_CONFIDENCE_THRESHOLD_BELOW_MIN"},
		"above":       {"threshold 1.1", "DCL_SEM_CONFIDENCE_THRESHOLD_ABOVE_MAX"},
	} {
		t.Run(name, func(t *testing.T) {
			src := `
policy MinimumAnswerConfidence {
  confidence {
    ` + tc.body + `
  }
}`
			result := CompileFiles([]string{writeTempDCL(t, src)})
			assertDiagnostic(t, result.Diagnostics, tc.code)
		})
	}
}

func TestPolicyMultipleFamiliesCompileToIR(t *testing.T) {
	src := `
policy SupportExecution {
  reliability {
    retry { attempts 2 }
    idempotency required
  }

  governance {
    audit required
    evidence required
  }

  confidence {
    threshold 0.8
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	policy := result.IR.Policies[0]
	wantFamilies := []string{"reliability", "governance", "confidence"}
	if len(policy.Families) != len(wantFamilies) {
		t.Fatalf("expected families %#v, got %#v", wantFamilies, policy.Families)
	}
	for i, want := range wantFamilies {
		if policy.Families[i] != want {
			t.Fatalf("expected families %#v, got %#v", wantFamilies, policy.Families)
		}
	}
	concernFamilies := map[string]string{}
	for _, concern := range policy.Concerns {
		concernFamilies[concern.Name] = concern.Family
	}
	for concern, family := range map[string]string{
		"retry":       "reliability",
		"idempotency": "reliability",
		"audit":       "governance",
		"evidence":    "governance",
		"confidence":  "confidence",
	} {
		if concernFamilies[concern] != family {
			t.Fatalf("expected %s in family %s, got %#v", concern, family, policy.Concerns)
		}
	}
}

func TestUnsupportedGroupedPolicyFamilyIsRejected(t *testing.T) {
	src := `
policy UnsupportedFamily {
  observability {
    audit required
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_FAMILY_UNKNOWN")
}

func TestInlineBlockConcernParses(t *testing.T) {
	src := `
policy InlineRetry {
  reliability {
    retry { attempts 3 backoff exponential }
  }
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

func TestPolicyConcernSemanticFailures(t *testing.T) {
	src := `
policy UnknownConcern {
  reliability {
    hedging allowed
  }
}

policy WrongFamily {
  security {
    timeout 30s
  }
}

policy InvalidValues {
  scalability {
    concurrency 0
    rate_limit 0 per minute
  }
}

policy Conflicting {
  availability {
    queue allowed
    queue forbidden
  }
}

policy UnsupportedParam {
  reliability {
    retry {
      attempts 3
      window 1m
    }
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_UNKNOWN")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_WRONG_FAMILY")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_VALUE_INVALID")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_CONFLICT")
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_UNSUPPORTED")
}

func TestBackoffRequiresRetry(t *testing.T) {
	src := `
policy BadRetry {
  reliability {
    backoff exponential
  }
}`
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_POLICY_CONCERN_PARAM_REQUIRED")
	assertDiagnosticMessage(t, result.Diagnostics, "backoff requires retry")
}

func TestCircuitBreakerProtectsOnlyEffects(t *testing.T) {
	src := `
actor Customer is human
effect CallPaymentGateway is invocation
shape Input { email: Email required }

policy PaymentDependencyProtection {
  reliability {
    circuit_breaker {
      opens after 5 failures
      resets after 30s
    }
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

func TestCircuitBreakerAttachmentAndParameterFailures(t *testing.T) {
	src := `
actor Customer is human
effect CallPaymentGateway is invocation
shape Input {}

policy BadCircuitTarget {
  reliability {
    circuit_breaker {
      opens after 5 failures
      resets after 30s
    }
  }
}

policy BadCircuitParams {
  reliability {
    circuit_breaker {
      opens after 0 failures
    }
  }
}

policy WrongCircuitFamily {
  availability {
    circuit_breaker {
      opens after 5 failures
      resets after 30s
    }
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

func TestFallbackOutcomeResolution(t *testing.T) {
	src := `
actor Customer is human
shape Input {}

policy Availability {
  availability {
    degradation allowed
    fallback MissingOutcome
  }
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

func TestEffectivePolicyEnvelopeNarrowsAndDerivesObligations(t *testing.T) {
	src := `
actor Customer is human
effect CallPaymentGateway is invocation
shape Input { email: Email required }

policy CapabilityReliability {
  reliability {
    timeout 30s
    idempotency allowed
  }
}

policy PaymentReliability {
  reliability {
    timeout 5s
    retry { attempts 3 }
  }
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
	// Capability-level timeout must be narrowed by a stricter effect-level timeout.
	timeout := findEffectiveConcern(t, effect.EffectiveConcerns, "timeout")
	if timeout.CompositionMode != "narrow" || scalarParameterValue(timeout.EffectiveParameters) != "5s" {
		t.Fatalf("expected narrowed effect timeout, got %#v", timeout)
	}
	// Retry is target-local and must not inherit/merge across boundaries.
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

func TestPolicyNarrowingViolation(t *testing.T) {
	src := `
actor Customer is human
effect CallPaymentGateway is invocation
shape Input {}

policy CapabilityReliability {
  reliability {
    timeout 30s
  }
}

policy SlowPaymentReliability {
  reliability {
    timeout 60s
  }
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

func TestPolicyWeakenedGuarantee(t *testing.T) {
	src := `
actor Customer is human
effect SendVerification is notify
shape Input {}

policy RequiredIdempotency {
  reliability {
    idempotency required
  }
}

policy WeakenedIdempotency {
  reliability {
    idempotency allowed
  }
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

func TestRetryRequiresIdempotency(t *testing.T) {
	src := `
actor Customer is human
effect SendVerification is notify
shape Input {}

policy RetryEmail {
  reliability {
    retry { attempts 3 }
  }
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

func TestPolicyCausationRequiresMatchingConcern(t *testing.T) {
	src := `
actor Customer is human
shape Input {}

policy CustomerSecurity {
  security {
    authorization required
  }
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

func TestConcernStrengthOrdering(t *testing.T) {
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
