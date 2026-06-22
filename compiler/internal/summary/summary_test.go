package summary

import (
	"testing"

	"capabilitylanguage/internal/compiler"
)

func TestFromIRSummarizesCapabilityShape(t *testing.T) {
	source := `language dcl 1.0

actor User is human
effect SaveGreeting is persistence

policy GreetingReliability {
  reliability {
    idempotency required
  }
}

shape GreetingInput {
  name: Text required
}

capability SayHello {
  intent GreetingInput from User

  outcome GreetingPrepared

  effects {
    SaveGreeting
  }

  policies {
    GreetingReliability governs capability
  }

  when {
    always GreetingPrepared
  }
}`

	result := compiler.CompileSource("summary-fixture.dcl", source)
	if compiler.HasErrors(result.Diagnostics) {
		t.Fatalf("fixture should compile: %#v", result.Diagnostics)
	}

	got := FromIR(result.IR)
	if len(got.Capabilities) != 1 {
		t.Fatalf("capability count = %d, want 1", len(got.Capabilities))
	}
	capability := got.Capabilities[0]
	if capability.Name != "SayHello" {
		t.Fatalf("capability name = %q, want SayHello", capability.Name)
	}
	if len(capability.Intents) != 1 || capability.Intents[0].InputShape != "GreetingInput" || capability.Intents[0].Actor != "User" {
		t.Fatalf("unexpected intents: %#v", capability.Intents)
	}
	if len(capability.Outcomes) != 1 || capability.Outcomes[0] != "GreetingPrepared" {
		t.Fatalf("unexpected outcomes: %#v", capability.Outcomes)
	}
	if len(capability.Effects) != 1 || capability.Effects[0].Effect != "SaveGreeting" {
		t.Fatalf("unexpected effects: %#v", capability.Effects)
	}
	if len(capability.Policies) != 1 || capability.Policies[0].Policy != "GreetingReliability" {
		t.Fatalf("unexpected policies: %#v", capability.Policies)
	}
	if len(got.Intents) != 1 || got.Intents[0].Capability != "SayHello" || got.Intents[0].InputShape != "GreetingInput" {
		t.Fatalf("unexpected top-level intents: %#v", got.Intents)
	}
	if len(got.Outcomes) != 1 || got.Outcomes[0].Name != "GreetingPrepared" || got.Outcomes[0].Capability != "SayHello" {
		t.Fatalf("unexpected top-level outcomes: %#v", got.Outcomes)
	}
	if got.DiagnosticsSummary.DiagnosticCount != 0 || got.DiagnosticsSummary.ErrorCount != 0 {
		t.Fatalf("unexpected diagnostics summary: %#v", got.DiagnosticsSummary)
	}
}

func TestFromIRSummarizesContextsAndLifecycle(t *testing.T) {
	source := `language dcl 1.0

context Payments {
  actor Customer is human

  shape PaymentInput {
    orderId: Uuid required
    amount: Money required
  }

  event PaymentReceived is {
    orderId: Uuid required
  }

  capability CollectPayment {
    intent PaymentInput from Customer

    outcomes {
      PaymentRequested
      PaymentExpired
    }

    when {
      always PaymentRequested
    }

    events {
      emits PaymentReceived
    }

    lifecycle {
      begin AwaitingPayment

      step AwaitingPayment waits for event PaymentReceived {
        deadline 15 minutes causing outcome PaymentExpired
      }

      end Paid
      end Expired

      move AwaitingPayment to Paid
        on event PaymentReceived

      move AwaitingPayment to Expired
        on outcome PaymentExpired
    }
  }
}`

	result := compiler.CompileSource("lifecycle-summary-fixture.dcl", source)
	if compiler.HasErrors(result.Diagnostics) {
		t.Fatalf("fixture should compile: %#v", result.Diagnostics)
	}

	got := FromIR(result.IR)
	if len(got.Contexts) != 1 || got.Contexts[0].Name != "Payments" {
		t.Fatalf("unexpected contexts: %#v", got.Contexts)
	}
	if len(got.Lifecycles) != 1 {
		t.Fatalf("lifecycle count = %d, want 1", len(got.Lifecycles))
	}
	lifecycle := got.Lifecycles[0]
	if lifecycle.Initial != "AwaitingPayment" {
		t.Fatalf("initial = %q, want AwaitingPayment", lifecycle.Initial)
	}
	if len(lifecycle.Terminal) != 2 {
		t.Fatalf("terminal states = %#v, want 2 states", lifecycle.Terminal)
	}
	if len(lifecycle.Transitions) != 2 {
		t.Fatalf("transitions = %#v, want 2 transitions", lifecycle.Transitions)
	}
	if got.Capabilities[0].Context != "Payments" {
		t.Fatalf("capability context = %q, want Payments", got.Capabilities[0].Context)
	}
}

func TestFromIRSummarizesDiagnostics(t *testing.T) {
	result := compiler.CompileSource("invalid-summary-fixture.dcl", "language dcl 99.0\nactor User is human\n")
	if !compiler.HasErrors(result.Diagnostics) {
		t.Fatalf("fixture should produce compiler errors")
	}

	got := FromIR(result.IR)
	if got.DiagnosticsSummary.DiagnosticCount != len(result.Diagnostics) {
		t.Fatalf("diagnostic count = %d, want %d", got.DiagnosticsSummary.DiagnosticCount, len(result.Diagnostics))
	}
	if got.DiagnosticsSummary.ErrorCount == 0 {
		t.Fatalf("expected error count in diagnostics summary: %#v", got.DiagnosticsSummary)
	}
}
