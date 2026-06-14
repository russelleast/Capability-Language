package compiler

import (
	"path/filepath"
	"testing"
)

func TestPolicyAttachmentsAndObservationIR(t *testing.T) {
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
		targetCapability: "RegisterCustomer",
		targetEffect:     "SendVerification",
		targetOutcome:    "Accepted",
		targetEvent:      "CustomerRegistered",
		targetLifecycle:  "RegisterCustomer",
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

func TestPolicyAndObservationFailures(t *testing.T) {
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
