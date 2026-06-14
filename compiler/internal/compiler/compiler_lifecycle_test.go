package compiler

import (
	"strings"
	"testing"

	"capabilitylanguage/internal/ir"
)

func TestValidSupervisedLifecycle(t *testing.T) {
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

func TestDuplicateLifecycleOwnershipRejected(t *testing.T) {
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

func TestMissingTransitionSourceCapabilityRejected(t *testing.T) {
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

func TestMissingTransitionSourceOutcomeRejected(t *testing.T) {
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

func TestCrossCapabilityTransitionRequiresIdentity(t *testing.T) {
	src := v07OrderFulfilmentSource(`
  supervises lifecycle FulfilmentLifecycle {
    begin step Received
    end step PaymentPending
    move Received to PaymentPending on outcome OrderAccepted from AcceptOrder
  }`)
	result := CompileFiles([]string{writeTempDCL(t, src)})
	assertDiagnostic(t, result.Diagnostics, "DCL_SEM_UNCORRELATED_TRANSITION_SOURCE")
}

func TestAmbiguousLifecycleTransitionRejected(t *testing.T) {
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

func TestOrdinaryLocalLifecycleAndLocalEventStillCompile(t *testing.T) {
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

func TestLifecycleCompletionSemantics(t *testing.T) {
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

func TestMultipleWaitsAndLegacyStepSyntax(t *testing.T) {
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

func TestLifecycleCompletionFailures(t *testing.T) {
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

func TestInvalidRecoveryLoop(t *testing.T) {
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

func TestSyntaxAndAuthoringImprovementsCompileToIR(t *testing.T) {
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

func TestEventOwnershipWarningsAndFailures(t *testing.T) {
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

func TestUnprovenEventSourceOwnershipWarns(t *testing.T) {
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

func TestDecisionProviderAmbiguityAndUnknownProvider(t *testing.T) {
	// "approver" intentionally collides as both actor symbol and role name.
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

func TestAlwaysAndBuiltinShadowingFailures(t *testing.T) {
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
