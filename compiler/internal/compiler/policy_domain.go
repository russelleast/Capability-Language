package compiler

import (
	"strconv"

	"capabilitylanguage/internal/ast"
	"capabilitylanguage/internal/ir"
)

type concernSpec struct {
	allowedFamilies map[string]bool
	composition     compositionMode
}

var policyFamilies = stringSet(
	"reliability", "availability", "scalability", "performance", "security", "compliance", "governance", "data_protection", "confidence",
)

var observationTypes = stringSet(
	observationCount,
	observationDuration,
	observationViolations,
	observationFailures,
	observationTransitions,
)

// concernSpecs is the compiler's single source of truth for concern support, attachment family, and composition semantics.
var concernSpecs = map[string]concernSpec{
	"retry":                {allowedFamilies: stringSet("reliability"), composition: modeTargetLocal},
	"backoff":              {allowedFamilies: stringSet("reliability"), composition: modeTargetLocal},
	"timeout":              {allowedFamilies: stringSet("reliability"), composition: modeNarrow},
	"idempotency":          {allowedFamilies: stringSet("reliability"), composition: modeNarrow},
	"compensation":         {allowedFamilies: stringSet("reliability"), composition: modeTargetLocal},
	"circuit_breaker":      {allowedFamilies: stringSet("reliability"), composition: modeTargetLocal},
	"degradation":          {allowedFamilies: stringSet("availability"), composition: modeNarrow},
	"fallback":             {allowedFamilies: stringSet("availability"), composition: modeTargetLocal},
	"dependency_tolerance": {allowedFamilies: stringSet("availability"), composition: modeAugment},
	"concurrency":          {allowedFamilies: stringSet("scalability"), composition: modeNarrow},
	"rate_limit":           {allowedFamilies: stringSet("scalability"), composition: modeNarrow},
	"queue":                {allowedFamilies: stringSet("scalability"), composition: modeNarrow},
	"backpressure":         {allowedFamilies: stringSet("scalability"), composition: modeTargetLocal},
	"latency":              {allowedFamilies: stringSet("performance"), composition: modeNarrow},
	"throughput":           {allowedFamilies: stringSet("performance"), composition: modeTargetLocal},
	"budget":               {allowedFamilies: stringSet("performance"), composition: modeNarrow},
	"authentication":       {allowedFamilies: stringSet("security"), composition: modeNarrow},
	"authorization":        {allowedFamilies: stringSet("security"), composition: modeAugment},
	"classification":       {allowedFamilies: stringSet("security"), composition: modeNarrow},
	"encryption":           {allowedFamilies: stringSet("security"), composition: modeNarrow},
	"audit":                {allowedFamilies: stringSet("compliance", "governance"), composition: modeAugment},
	"retention":            {allowedFamilies: stringSet("compliance", "governance", "data_protection"), composition: modeNarrow},
	"approval":             {allowedFamilies: stringSet("compliance", "governance"), composition: modeAugment},
	"evidence":             {allowedFamilies: stringSet("compliance", "governance"), composition: modeAugment},
	"sensitivity":          {allowedFamilies: stringSet("data_protection"), composition: modeNarrow},
	"masking":              {allowedFamilies: stringSet("data_protection"), composition: modeNarrow},
	"minimization":         {allowedFamilies: stringSet("data_protection"), composition: modeNarrow},
	"deletion":             {allowedFamilies: stringSet("data_protection"), composition: modeNarrow},
	"confidence":           {allowedFamilies: stringSet("confidence"), composition: modeNarrow},
}

func isBuiltinType(name string) bool {
	switch name {
	case "Text", "Boolean", "Number", "Date", "DateTime", "Uuid", "Email", "Money":
		return true
	}
	return false
}

func validPolicyFamily(family string) bool {
	return policyFamilies[family]
}

func validPolicyKind(kind string) bool {
	return kind == "confidence"
}

func isConfidencePolicy(policy ast.PolicyDecl) bool {
	return policy.Kind == "confidence" || policy.Family == "confidence"
}

func policyConcernFamily(policy ast.PolicyDecl) string {
	if isConfidencePolicy(policy) {
		return "confidence"
	}
	return policy.Family
}

func validObservationType(observationType string) bool {
	return observationTypes[observationType]
}

func knownConcern(name string) bool {
	_, ok := concernSpecs[name]
	return ok
}

func concernAllowedInFamily(name, family string) bool {
	spec, ok := concernSpecs[name]
	if !ok {
		return false
	}
	return spec.allowedFamilies[family]
}

func concernCompositionMode(concern string) compositionMode {
	spec, ok := concernSpecs[concern]
	if !ok {
		return modeConflict
	}
	return spec.composition
}

func findConcern(policy ast.PolicyDecl, name string) (ast.ConcernDecl, bool) {
	for _, concern := range policyConcerns(policy) {
		if concern.Name == name {
			return concern, true
		}
	}
	return ast.ConcernDecl{}, false
}

func policyConcerns(policy ast.PolicyDecl) []ast.ConcernDecl {
	out := append([]ast.ConcernDecl(nil), policy.Concerns...)
	if isConfidencePolicy(policy) {
		if threshold, ok := confidenceThresholdValue(policy); ok {
			out = append(out, ast.ConcernDecl{
				Name: "confidence",
				Parameters: []ast.ConcernParameter{{
					Name:   "threshold",
					Values: []string{strconv.FormatFloat(threshold, 'f', -1, 64)},
					Span:   policy.ThresholdSpan,
				}},
				Span: policy.Span,
			})
		}
	}
	return out
}

func parameter(concern ast.ConcernDecl, name string) (ast.ConcernParameter, bool) {
	for _, param := range concern.Parameters {
		if param.Name == name {
			return param, true
		}
	}
	return ast.ConcernParameter{}, false
}

func scalarValues(concern ast.ConcernDecl) []string {
	if param, ok := parameter(concern, "value"); ok {
		return param.Values
	}
	return nil
}

func positiveInteger(value string) bool {
	n, err := strconv.Atoi(value)
	return err == nil && n > 0
}

func positiveDuration(values []string) bool {
	switch len(values) {
	case 1:
		number, unit := splitNumberUnit(values[0])
		return positiveInteger(number) && validDurationUnit(unit)
	case 2:
		return positiveInteger(values[0]) && validDurationUnit(values[1])
	default:
		return false
	}
}

func splitNumberUnit(value string) (string, string) {
	for i, r := range value {
		if r < '0' || r > '9' {
			return value[:i], value[i:]
		}
	}
	return value, ""
}

func validDurationUnit(unit string) bool {
	switch unit {
	case "ms", "millisecond", "milliseconds", "s", "second", "seconds", "m", "minute", "minutes", "h", "hour", "hours", "d", "day", "days":
		return true
	default:
		return false
	}
}

func validPeriodUnit(unit string) bool {
	switch unit {
	case "day", "days", "month", "months", "year", "years":
		return true
	default:
		return false
	}
}

func concernIR(family string, concern ast.ConcernDecl) ir.ConcernIR {
	out := ir.ConcernIR{Name: concern.Name, Family: family, SourceLocation: concern.Span}
	for _, param := range concern.Parameters {
		out.Parameters = append(out.Parameters, ir.ConcernParameterIR{Name: param.Name, Values: append([]string(nil), param.Values...)})
	}
	return out
}

func confidenceConcernIR(policy ast.PolicyDecl, threshold float64) ir.ConcernIR {
	return ir.ConcernIR{
		Name:   "confidence",
		Family: "confidence",
		Parameters: []ir.ConcernParameterIR{{
			Name:   "threshold",
			Values: []string{strconv.FormatFloat(threshold, 'f', -1, 64)},
		}},
		SourceLocation: policy.Span,
	}
}

func objectiveIR(concern ast.ConcernDecl) ir.ObjectiveIR {
	switch concern.Name {
	case "latency", "throughput", "budget", "retention":
		return ir.ObjectiveIR{Concern: concern.Name, Values: scalarOrParameterValues(concern)}
	default:
		return ir.ObjectiveIR{}
	}
}

func obligationIR(concern ast.ConcernDecl, targetKind, targetName string) ir.DerivedObligationIR {
	return ir.DerivedObligationIR{
		Concern:    concern.Name,
		Obligation: obligationName(concern.Name),
		TargetKind: targetKind,
		TargetName: targetName,
	}
}

func obligationIRFromConcernIR(concern ir.ConcernIR, targetKind, targetName string) ir.DerivedObligationIR {
	return ir.DerivedObligationIR{
		Concern:    concern.Name,
		Obligation: obligationName(concern.Name),
		TargetKind: targetKind,
		TargetName: targetName,
	}
}

func obligationName(concern string) string {
	switch concern {
	case "retry", "backoff", "timeout", "idempotency", "compensation":
		return "verify reliability behavior"
	case "circuit_breaker":
		return "protect dependency effect"
	case "latency", "throughput", "budget":
		return "verify performance objective"
	case "audit", "evidence":
		return "preserve governance evidence"
	case "retention", "deletion", "masking", "minimization":
		return "verify data protection obligation"
	default:
		return "verify policy concern"
	}
}

func scalarOrParameterValues(concern ast.ConcernDecl) []string {
	if values := scalarValues(concern); len(values) > 0 {
		return append([]string(nil), values...)
	}
	var out []string
	for _, param := range concern.Parameters {
		out = append(out, param.Name)
		out = append(out, param.Values...)
	}
	return out
}

func stringSet(values ...string) map[string]bool {
	out := make(map[string]bool, len(values))
	for _, value := range values {
		out[value] = true
	}
	return out
}
