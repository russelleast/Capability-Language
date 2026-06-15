package compiler

import (
	"os"
	"path/filepath"
	"testing"

	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/ir"
)

func assertDiagnostic(t *testing.T, diags []diagnostic.Diagnostic, code string) {
	t.Helper()
	for _, diag := range diags {
		if diag.Code == code {
			return
		}
	}
	t.Fatalf("expected diagnostic %s in %#v", code, diags)
}

func assertNoDiagnostic(t *testing.T, diags []diagnostic.Diagnostic, code string) {
	t.Helper()
	for _, diag := range diags {
		if diag.Code == code {
			t.Fatalf("unexpected diagnostic %s in %#v", code, diags)
		}
	}
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
