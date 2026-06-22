package lsp

import (
	"testing"

	"capabilitylanguage/internal/compiler"
)

const symbolTestPath = "/workspace/order.dcl"

func TestDocumentSymbolBuilderCapabilityHierarchy(t *testing.T) {
	source := `language dcl 0.10

effect PersistOrder is persistence

policy RetryPayment {
  family reliability
}

event OrderSubmitted is {
  orderId: Uuid required
}

capability PlaceOrder {
  intent OrderInput from Customer

  outcomes {
    OrderAccepted
  }

  effects {
    PersistOrder
  }

  events {
    emits OrderSubmitted
  }

  policies {
    RetryPayment governs capability
  }
}
`
	symbols := buildDocumentSymbols(t, source)
	capability := findSymbol(t, symbols, "PlaceOrder")

	expectedChildren := []string{"OrderInput", "OrderAccepted", "PersistOrder", "OrderSubmitted", "RetryPayment"}
	for _, name := range expectedChildren {
		_ = findSymbol(t, capability.Children, name)
	}
	if capability.Kind != symbolKindClass {
		t.Fatalf("expected capability symbol kind class, got %d", capability.Kind)
	}
}

func TestDocumentSymbolBuilderContexts(t *testing.T) {
	source := `language dcl 0.10

context Commerce {
  actor Customer is human

  context Payments {
    shape PaymentInput {
      amount: Decimal required
    }

    capability CapturePayment {
      intent PaymentInput from Customer
      outcome PaymentCaptured
    }
  }
}
`
	symbols := buildDocumentSymbols(t, source)
	commerce := findSymbol(t, symbols, "Commerce")
	payments := findSymbol(t, commerce.Children, "Commerce.Payments")
	_ = findSymbol(t, commerce.Children, "Customer")
	_ = findSymbol(t, payments.Children, "PaymentInput")
	_ = findSymbol(t, payments.Children, "CapturePayment")
}

func TestDocumentSymbolBuilderLifecycles(t *testing.T) {
	source := `language dcl 0.10

capability FulfilOrder {
  intent OrderInput from Customer
  outcome FulfilmentOpened

  supervises lifecycle OrderLifecycle {
    begin Created
    step Created
    step AwaitingPayment
    end Completed
  }
}
`
	symbols := buildDocumentSymbols(t, source)
	capability := findSymbol(t, symbols, "FulfilOrder")
	lifecycle := findSymbol(t, capability.Children, "OrderLifecycle")
	for _, step := range []string{"Created", "AwaitingPayment", "Completed"} {
		child := findSymbol(t, lifecycle.Children, step)
		if child.Detail != "Lifecycle Step" {
			t.Fatalf("expected lifecycle step detail for %s, got %q", step, child.Detail)
		}
	}
	if lifecycle.Kind != symbolKindInterface {
		t.Fatalf("expected lifecycle symbol kind interface, got %d", lifecycle.Kind)
	}
}

func TestDocumentSymbolBuilderEmptyDocument(t *testing.T) {
	symbols := buildDocumentSymbols(t, "language dcl 0.10\n")
	if len(symbols) != 0 {
		t.Fatalf("expected no symbols, got %+v", symbols)
	}
}

func TestDocumentSymbolBuilderSourceRanges(t *testing.T) {
	source := `language dcl 0.10

actor Customer is human

capability PlaceOrder {
  intent OrderInput from Customer
}
`
	symbols := buildDocumentSymbols(t, source)
	actor := findSymbol(t, symbols, "Customer")
	capability := findSymbol(t, symbols, "PlaceOrder")
	intent := findSymbol(t, capability.Children, "OrderInput")

	assertPosition(t, actor.Range.Start, 2, 0)
	assertPosition(t, capability.Range.Start, 4, 0)
	assertPosition(t, intent.Range.Start, 5, 2)
	if actor.SelectionRange != actor.Range {
		t.Fatalf("expected actor selection range to match declaration range")
	}
}

func TestSymbolProviderUsesOpenDocumentText(t *testing.T) {
	host := NewWorkspaceHost()
	host.Documents().Open("file:///workspace/order.dcl", 1, `language dcl 0.10

capability InMemoryOnly {
  intent OrderInput from Customer
}
`)
	provider := NewSymbolProvider(host)
	symbols := provider.DocumentSymbols("file:///workspace/order.dcl")
	_ = findSymbol(t, symbols, "InMemoryOnly")
}

func buildDocumentSymbols(t *testing.T, source string) []DocumentSymbol {
	t.Helper()
	parsed := compiler.ParseSources([]compiler.SourceFile{{Path: symbolTestPath, Text: source}})
	builder := DocumentSymbolBuilder{path: symbolTestPath}
	return builder.Build(parsed.Program)
}

func findSymbol(t *testing.T, symbols []DocumentSymbol, name string) DocumentSymbol {
	t.Helper()
	for _, symbol := range symbols {
		if symbol.Name == name {
			return symbol
		}
	}
	t.Fatalf("expected symbol %q in %+v", name, symbols)
	return DocumentSymbol{}
}

func assertPosition(t *testing.T, actual Position, line, character int) {
	t.Helper()
	if actual.Line != line || actual.Character != character {
		t.Fatalf("expected position %d:%d, got %d:%d", line, character, actual.Line, actual.Character)
	}
}
