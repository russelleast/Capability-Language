package lsp

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWorkspaceSymbolsEmptyWorkspace(t *testing.T) {
	host := NewWorkspaceHost()
	provider := NewWorkspaceSymbolProvider(host)
	if symbols := provider.WorkspaceSymbols(""); len(symbols) != 0 {
		t.Fatalf("expected no symbols, got %+v", symbols)
	}
}

func TestWorkspaceSymbolsSingleFileWorkspace(t *testing.T) {
	dir := t.TempDir()
	writeDCLFile(t, dir, "payment.dcl", `language dcl 0.10

event PaymentCaptured is {
  paymentId: Uuid required
}

policy PaymentRetry {
  reliability {
  }
}

capability CapturePayment {
  intent PaymentInput from Customer
  outcome PaymentCaptured
}
`)
	provider := NewWorkspaceSymbolProvider(hostWithFolder(dir))
	symbols := provider.WorkspaceSymbols("payment")

	_ = findWorkspaceSymbol(t, symbols, "CapturePayment", "Capability")
	_ = findWorkspaceSymbol(t, symbols, "PaymentCaptured", "Event")
	_ = findWorkspaceSymbol(t, symbols, "PaymentRetry", "Policy")
}

func TestWorkspaceSymbolsMultiFileWorkspace(t *testing.T) {
	dir := t.TempDir()
	writeDCLFile(t, dir, "orders.dcl", `language dcl 0.10

capability PlaceOrder {
  intent OrderInput from Customer
}
`)
	writeDCLFile(t, dir, "payments.dcl", `language dcl 0.10

capability CapturePayment {
  intent PaymentInput from Customer
}
`)
	provider := NewWorkspaceSymbolProvider(hostWithFolder(dir))
	symbols := provider.WorkspaceSymbols("")

	order := findWorkspaceSymbol(t, symbols, "PlaceOrder", "Capability")
	payment := findWorkspaceSymbol(t, symbols, "CapturePayment", "Capability")
	if order.Location.URI == payment.Location.URI {
		t.Fatalf("expected symbols from different files, got %s", order.Location.URI)
	}
}

func TestWorkspaceSymbolsFuzzySearch(t *testing.T) {
	host := NewWorkspaceHost()
	host.Documents().Open("file:///workspace/payment.dcl", 1, `language dcl 0.10

capability CapturePayment {
  intent PaymentInput from Customer
}
`)
	provider := NewWorkspaceSymbolProvider(host)
	symbols := provider.WorkspaceSymbols("cp")
	_ = findWorkspaceSymbol(t, symbols, "CapturePayment", "Capability")
}

func TestWorkspaceSymbolsCaseInsensitiveSearch(t *testing.T) {
	host := NewWorkspaceHost()
	host.Documents().Open("file:///workspace/payment.dcl", 1, `language dcl 0.10

event PaymentCaptured is {
  paymentId: Uuid required
}
`)
	provider := NewWorkspaceSymbolProvider(host)
	symbols := provider.WorkspaceSymbols("paymentcaptured")
	_ = findWorkspaceSymbol(t, symbols, "PaymentCaptured", "Event")
}

func TestWorkspaceSymbolsDuplicateNamesInDifferentContexts(t *testing.T) {
	host := NewWorkspaceHost()
	host.Documents().Open("file:///workspace/duplicates.dcl", 1, `language dcl 0.10

context Payments {
  capability Capture {
    intent PaymentInput from Customer
  }
}

context Refunds {
  capability Capture {
    intent RefundInput from Customer
  }
}
`)
	provider := NewWorkspaceSymbolProvider(host)
	symbols := provider.WorkspaceSymbols("Capture")
	payments := findWorkspaceSymbolWithContainer(t, symbols, "Capture", "Capability", "Payments")
	refunds := findWorkspaceSymbolWithContainer(t, symbols, "Capture", "Capability", "Refunds")

	if payments.Data["context"] != "Payments" || refunds.Data["context"] != "Refunds" {
		t.Fatalf("expected semantic context identities, got %+v and %+v", payments.Data, refunds.Data)
	}
}

func TestWorkspaceSymbolsSourceLocations(t *testing.T) {
	host := NewWorkspaceHost()
	host.Documents().Open("file:///workspace/order.dcl", 1, `language dcl 0.10

actor Customer is human

capability PlaceOrder {
  intent OrderInput from Customer
}
`)
	provider := NewWorkspaceSymbolProvider(host)
	symbols := provider.WorkspaceSymbols("")
	actor := findWorkspaceSymbol(t, symbols, "Customer", "Actor")
	capability := findWorkspaceSymbol(t, symbols, "PlaceOrder", "Capability")
	intent := findWorkspaceSymbol(t, symbols, "OrderInput", "Intent")

	if actor.Location.URI != "file:///workspace/order.dcl" {
		t.Fatalf("unexpected actor URI: %s", actor.Location.URI)
	}
	assertPosition(t, actor.Location.Range.Start, 2, 6)
	assertPosition(t, capability.Location.Range.Start, 4, 11)
	assertPosition(t, intent.Location.Range.Start, 5, 9)
}

func writeDCLFile(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
}

func hostWithFolder(dir string) *WorkspaceHost {
	host := NewWorkspaceHost()
	host.SetWorkspaceFolders([]WorkspaceFolder{{URI: pathToFileURI(dir), Name: filepath.Base(dir)}})
	return host
}

func findWorkspaceSymbol(t *testing.T, symbols []WorkspaceSymbol, name, detail string) WorkspaceSymbol {
	t.Helper()
	for _, symbol := range symbols {
		if symbol.Name == name && symbol.Detail == detail {
			return symbol
		}
	}
	t.Fatalf("expected workspace symbol %s %s in %+v", detail, name, symbols)
	return WorkspaceSymbol{}
}

func findWorkspaceSymbolWithContainer(t *testing.T, symbols []WorkspaceSymbol, name, detail, container string) WorkspaceSymbol {
	t.Helper()
	for _, symbol := range symbols {
		if symbol.Name == name && symbol.Detail == detail && symbol.ContainerName == container {
			return symbol
		}
	}
	t.Fatalf("expected workspace symbol %s %s in container %s in %+v", detail, name, container, symbols)
	return WorkspaceSymbol{}
}
