package compiler

import (
	"encoding/json"
	"testing"

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

func TestLexerCoversTokens(t *testing.T) {
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

func TestLexerCoversConcernValues(t *testing.T) {
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

func TestDocumentedExamplesCompile(t *testing.T) {
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

func TestRemovedFormsAreRejected(t *testing.T) {
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
