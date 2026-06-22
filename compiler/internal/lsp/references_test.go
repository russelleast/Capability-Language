package lsp

import (
	"testing"
)

func TestReferenceProviderEventReferences(t *testing.T) {
	source := `language dcl 0.10

event PaymentCaptured is {
  paymentId: Uuid required
}

policy PaymentPolicy {
  family reliability
}

capability CapturePayment {
  intent PaymentInput from Customer
  events {
    emits PaymentCaptured
  }
  policies {
    PaymentPolicy governs event PaymentCaptured
  }
  lifecycle {
    begin Pending
    step Pending waits for event PaymentCaptured
    end Completed
    move Pending to Completed
      on event PaymentCaptured
  }
}
`
	host := NewWorkspaceHost()
	uri := "file:///workspace/payment.dcl"
	host.Documents().Open(uri, 1, source)
	refs := NewReferenceProvider(host).References(uri, positionOf(t, source, "event PaymentCaptured is", "PaymentCaptured"), true)

	assertReferenceLines(t, refs, uri, []int{2, 13, 16, 20, 22})
}

func TestReferenceProviderOutcomeReferences(t *testing.T) {
	source := `language dcl 0.10

capability ApprovePayment {
  intent PaymentInput from Customer
  outcome Approved
  policies {
    PaymentPolicy governs outcome Approved
  }
  when {
    always Approved
  }
  lifecycle {
    begin Pending
    step Pending waits for outcome Approved
    end Completed
    move Pending to Completed
      on outcome Approved
  }
}
`
	host := NewWorkspaceHost()
	uri := "file:///workspace/payment.dcl"
	host.Documents().Open(uri, 1, source)
	refs := NewReferenceProvider(host).References(uri, positionOf(t, source, "outcome Approved", "Approved"), true)

	assertReferenceLines(t, refs, uri, []int{4, 6, 9, 13, 15})
}

func TestReferenceProviderShapeReferences(t *testing.T) {
	source := `language dcl 0.10

shape PaymentRequest {
  paymentId: Uuid required
}

event PaymentRequested is PaymentRequest

capability CapturePayment {
  intent PaymentRequest from Customer
  outcome PaymentAccepted is PaymentRequest
}
`
	host := NewWorkspaceHost()
	uri := "file:///workspace/payment.dcl"
	host.Documents().Open(uri, 1, source)
	refs := NewReferenceProvider(host).References(uri, positionOf(t, source, "shape PaymentRequest", "PaymentRequest"), true)

	assertReferenceLines(t, refs, uri, []int{2, 6, 9, 10})
}

func TestReferenceProviderCrossFileReferences(t *testing.T) {
	dir := t.TempDir()
	events := writeDefinitionFixture(t, dir, "events.dcl", `language dcl 0.10

event PaymentCaptured is {
  paymentId: Uuid required
}
`)
	capabilitySource := `language dcl 0.10

capability CapturePayment {
  intent PaymentInput from Customer
  events {
    emits PaymentCaptured
  }
}
`
	capability := writeDefinitionFixture(t, dir, "capability.dcl", capabilitySource)

	host := hostWithFolder(dir)
	refs := NewReferenceProvider(host).References(pathToFileURI(events), Position{Line: 2, Character: 6}, true)

	assertHasLocation(t, refs, pathToFileURI(events), 2)
	assertHasLocation(t, refs, pathToFileURI(capability), 5)
}

func TestReferenceProviderDuplicateNamesResolveByContext(t *testing.T) {
	source := `language dcl 0.10

context Payments {
  shape PaymentInput {
    paymentId: Uuid required
  }

  capability CapturePayment {
    intent PaymentInput from Customer
  }
}

context Refunds {
  shape PaymentInput {
    refundId: Uuid required
  }

  capability RefundPayment {
    intent PaymentInput from Customer
  }
}
`
	host := NewWorkspaceHost()
	uri := "file:///workspace/payment.dcl"
	host.Documents().Open(uri, 1, source)
	refs := NewReferenceProvider(host).References(uri, positionOf(t, source, "shape PaymentInput", "PaymentInput"), true)

	assertReferenceLines(t, refs, uri, []int{3, 8})
}

func TestReferenceProviderNoReferences(t *testing.T) {
	source := `language dcl 0.10

shape PaymentRequest {
  paymentId: Uuid required
}
`
	host := NewWorkspaceHost()
	uri := "file:///workspace/payment.dcl"
	host.Documents().Open(uri, 1, source)
	refs := NewReferenceProvider(host).References(uri, positionOf(t, source, "shape PaymentRequest", "PaymentRequest"), false)

	if len(refs) != 0 {
		t.Fatalf("expected no references without declaration, got %+v", refs)
	}
}

func assertReferenceLines(t *testing.T, refs []Location, uri string, lines []int) {
	t.Helper()
	if len(refs) != len(lines) {
		t.Fatalf("expected %d refs, got %d: %+v", len(lines), len(refs), refs)
	}
	for i, line := range lines {
		assertLocation(t, refs[i], uri, line, refs[i].Range.Start.Character)
		if refs[i].Range.Start.Line != line {
			t.Fatalf("expected ref %d on line %d, got %+v", i, line, refs[i])
		}
	}
}

func assertHasLocation(t *testing.T, refs []Location, uri string, line int) {
	t.Helper()
	for _, ref := range refs {
		if ref.URI == uri && ref.Range.Start.Line == line {
			return
		}
	}
	t.Fatalf("expected reference at %s:%d in %+v", uri, line, refs)
}
