package compiler

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestContextDependencyResolutionAndIR(t *testing.T) {
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

func TestPrivateSymbolsAreVisibleOnlyInsideOwningContext(t *testing.T) {
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

func TestMissingDependencyAndNonTransitiveVisibility(t *testing.T) {
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

func TestAmbiguousSymbolAndFullyQualifiedDisambiguation(t *testing.T) {
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

func TestNestedContextBlocksNormalizeToQualifiedContext(t *testing.T) {
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

func TestDependencyCycleUndefinedContextDuplicateAndUnused(t *testing.T) {
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
