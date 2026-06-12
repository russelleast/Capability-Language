package compiler

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"capabilitylanguage/internal/ast"
	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/ir"
)

type compositionMode string

const (
	modeAugment     compositionMode = "augment"
	modeNarrow      compositionMode = "narrow"
	modeTargetLocal compositionMode = "target-local"
	modeConflict    compositionMode = "conflict"
)

type strengthResult string

const (
	strengthEqual        strengthResult = "equal"
	strengthStronger     strengthResult = "stronger"
	strengthWeaker       strengthResult = "weaker"
	strengthIncomparable strengthResult = "incomparable"
)

type attachedPolicyConcern struct {
	Policy     ast.PolicyDecl
	Use        ast.PolicyUse
	Attachment ir.PolicyAttachmentIR
	Concern    ast.ConcernDecl
}

func (c *compiler) deriveEffectivePolicies(out *ir.ProgramIR) {
	for _, cap := range c.program.Capabilities {
		envelopes := c.deriveCapabilityEffectivePolicies(cap)
		out.EffectivePolicies = append(out.EffectivePolicies, envelopes...)
	}
}

func (c *compiler) deriveCapabilityEffectivePolicies(cap ast.CapabilityDecl) []ir.EffectivePolicyIR {
	capability := c.deriveEnvelope(cap, "capability", cap.Name, nil)
	envelopes := []ir.EffectivePolicyIR{capability}

	for _, effect := range cap.Effects {
		envelopes = append(envelopes, c.deriveEnvelope(cap, "effect", effect.Name, &capability))
	}
	for _, outcome := range cap.Outcomes {
		envelopes = append(envelopes, c.deriveEnvelope(cap, "outcome", outcome.Name, &capability))
	}
	for _, event := range c.policyEventTargets(cap) {
		envelopes = append(envelopes, c.deriveEnvelope(cap, "event", event, &capability))
	}
	if cap.Lifecycle != nil {
		envelopes = append(envelopes, c.deriveEnvelope(cap, "lifecycle", cap.Name, &capability))
	}

	c.applyPolicyCausation(cap, envelopes)
	sortEffectivePolicyIR(envelopes)
	return envelopes
}

func (c *compiler) deriveEnvelope(cap ast.CapabilityDecl, targetKind, targetSymbol string, parent *ir.EffectivePolicyIR) ir.EffectivePolicyIR {
	env := ir.EffectivePolicyIR{
		ID:                   id("effective_policy", cap.Name+"."+targetKind+"."+targetSymbol),
		TargetKind:           targetKind,
		TargetSymbol:         targetSymbol,
		ContainingCapability: cap.Name,
		Portability:          "portable",
	}

	effective := map[string]ir.EffectiveConcernIR{}
	if parent != nil {
		for _, concern := range parent.EffectiveConcerns {
			if !inheritsAcrossBoundary(concern.Name) {
				continue
			}
			inherited := concern
			inherited.TargetKind = targetKind
			inherited.TargetSymbol = targetSymbol
			inherited.InheritedFrom = parent.TargetKind + ":" + parent.TargetSymbol
			effective[concern.Name] = inherited
		}
	}

	direct := c.attachedPolicyConcerns(cap, targetKind, targetSymbol)
	for _, item := range direct {
		env.AppliedPolicies = appendUnique(env.AppliedPolicies, item.Policy.Name)
		env.SourceLocations = append(env.SourceLocations, item.Use.Span)
		mode := concernCompositionMode(item.Concern.Name)
		if mode == "" {
			mode = modeConflict
		}
		next := effectiveConcernIR(item, targetKind, targetSymbol, string(mode))
		current, exists := effective[item.Concern.Name]
		if !exists {
			effective[item.Concern.Name] = next
			env.CompositionResults = append(env.CompositionResults, compositionResult(item.Concern.Name, targetKind, targetSymbol, string(mode), []string{item.Policy.Name}, "applied"))
			continue
		}

		result, diagCode, diagMessage := c.composeEffectiveConcern(current, next, item, parent != nil)
		env.CompositionResults = append(env.CompositionResults, result)
		if diagCode != "" {
			env.Conflicts = append(env.Conflicts, ir.PolicyConflictIR{
				Concern:      item.Concern.Name,
				TargetKind:   targetKind,
				TargetSymbol: targetSymbol,
				Policies:     result.SourcePolicies,
				Reason:       diagMessage,
			})
			c.diags.Error(diagCode, diagMessage, item.Concern.Span, item.Policy.Name)
			continue
		}
		effective[item.Concern.Name] = mergeEffectiveConcern(current, next, result)
	}

	for _, concern := range effective {
		env.EffectiveConcerns = append(env.EffectiveConcerns, concern)
		env.AppliedPolicies = appendUniqueMany(env.AppliedPolicies, concern.SourcePolicies)
		env.Obligations = append(env.Obligations, policyObligations(concern)...)
	}
	c.validateEnvelopeCompatibility(env)
	sortEnvelope(&env)
	return env
}

func (c *compiler) composeEffectiveConcern(current, next ir.EffectiveConcernIR, item attachedPolicyConcern, hasParent bool) (ir.PolicyCompositionResultIR, string, string) {
	policies := appendUniqueMany(append([]string(nil), current.SourcePolicies...), next.SourcePolicies)
	mode := concernCompositionMode(next.Name)
	result := compositionResult(next.Name, next.TargetKind, next.TargetSymbol, string(mode), policies, "applied")

	if mode == modeAugment {
		result.Result = "augmented"
		return result, "", ""
	}

	if sameConcernParameters(current.EffectiveParameters, next.EffectiveParameters) {
		result.Result = "redundant"
		c.diags.Warning("DCL_SEM_REDUNDANT_POLICY", "policy concern is already effective at this boundary", item.Concern.Span, item.Policy.Name)
		return result, "", ""
	}

	if !hasParent || current.InheritedFrom == "" {
		result.Mode = string(modeConflict)
		result.Result = "conflict"
		code := duplicateConcernDiagnostic(next.Name)
		return result, code, fmt.Sprintf("conflicting %s concerns on %s %s", next.Name, next.TargetKind, next.TargetSymbol)
	}

	switch mode {
	case modeNarrow:
		strength := compareConcernStrength(current.Name, current.EffectiveParameters, next.EffectiveParameters)
		result.Result = string(strength)
		switch strength {
		case strengthEqual, strengthStronger:
			result.Mode = string(modeNarrow)
			return result, "", ""
		case strengthWeaker:
			return result, weakeningDiagnostic(next.Name), fmt.Sprintf("%s %s weakens enclosing %s policy on %s %s", next.Name, parametersText(next.EffectiveParameters), current.Name, next.TargetKind, next.TargetSymbol)
		default:
			c.diags.Warning(incomparableDiagnostic(next.Name), fmt.Sprintf("%s policy values cannot be safely compared across boundaries", next.Name), item.Concern.Span, item.Policy.Name)
			return result, "", ""
		}
	case modeTargetLocal:
		result.Mode = string(modeTargetLocal)
		result.Result = "target-local"
		return result, "", ""
	default:
		result.Mode = string(modeConflict)
		result.Result = "conflict"
		return result, "DCL_SEM_INCOMPATIBLE_POLICY_COMBINATION", fmt.Sprintf("unsupported composition for %s on %s %s", next.Name, next.TargetKind, next.TargetSymbol)
	}
}

func (c *compiler) validateEnvelopeCompatibility(env ir.EffectivePolicyIR) {
	concerns := map[string]ir.EffectiveConcernIR{}
	for _, concern := range env.EffectiveConcerns {
		concerns[concern.Name] = concern
	}
	if retry, ok := concerns["retry"]; ok {
		if idempotency, ok := concerns["idempotency"]; ok {
			if scalarParameterValue(idempotency.EffectiveParameters) == "forbidden" {
				c.diags.Error("DCL_SEM_RETRY_REQUIRES_IDEMPOTENCY", fmt.Sprintf("retry requires idempotency allowed or required on %s %s", env.TargetKind, env.TargetSymbol), diagnostic.Span{}, retry.SourcePolicies[0])
			}
		} else {
			c.diags.Error("DCL_SEM_RETRY_REQUIRES_IDEMPOTENCY", fmt.Sprintf("retry requires idempotency allowed or required on %s %s", env.TargetKind, env.TargetSymbol), diagnostic.Span{}, retry.SourcePolicies[0])
		}
	}
}

func (c *compiler) applyPolicyCausation(cap ast.CapabilityDecl, envelopes []ir.EffectivePolicyIR) {
	attached := map[string][]ir.EffectivePolicyIR{}
	for _, env := range envelopes {
		for _, policy := range env.AppliedPolicies {
			attached[policy] = append(attached[policy], env)
		}
	}
	for _, branch := range cap.When {
		if branch.Otherwise {
			continue
		}
		isPolicy := branch.SourceKind == "policy" || branch.Decision == "denied" || branch.Decision == "denies"
		if !isPolicy {
			continue
		}
		if !c.hasGlobal("policy", branch.SourceName) {
			c.diags.Error("DCL_SEM_POLICY_CAUSATION_POLICY_UNKNOWN", "policy causation references unknown policy", branch.Span, branch.SourceName)
			continue
		}
		matches := attached[branch.SourceName]
		if len(matches) == 0 {
			c.diags.Error("DCL_SEM_POLICY_CAUSATION_POLICY_UNATTACHED", "policy causation references a policy not attached to this capability", branch.Span, branch.SourceName)
			continue
		}
		state := normalizePolicyState(branch.Decision)
		if !knownPolicyState(state) {
			c.diags.Error("DCL_SEM_POLICY_CAUSATION_STATE_INVALID", "unknown policy causation state", branch.Span, branch.Decision)
			continue
		}
		concern, env, ok := policyStateConcern(state, branch.SourceName, matches)
		if !ok {
			c.diags.Error("DCL_SEM_POLICY_CAUSATION_CONCERN_MISSING", fmt.Sprintf("policy %s cannot produce state %s because no matching concern is present", branch.SourceName, branch.Decision), branch.Span, branch.SourceName)
			continue
		}
		for i := range envelopes {
			if envelopes[i].ID == env.ID {
				envelopes[i].Causations = append(envelopes[i].Causations, ir.PolicyCausationIR{
					Policy:         branch.SourceName,
					Concern:        concern,
					State:          state,
					Outcome:        branch.Outcome,
					TargetKind:     env.TargetKind,
					TargetSymbol:   env.TargetSymbol,
					SourceLocation: branch.Span,
				})
			}
		}
	}
}

func (c *compiler) attachedPolicyConcerns(cap ast.CapabilityDecl, targetKind, targetSymbol string) []attachedPolicyConcern {
	var out []attachedPolicyConcern
	for _, use := range cap.Policies {
		if use.TargetKind != targetKind || policyTargetName(cap, use) != targetSymbol {
			continue
		}
		policy, ok := c.policies[use.Name]
		if !ok {
			continue
		}
		attachment := ir.PolicyAttachmentIR{Capability: cap.Name, TargetKind: use.TargetKind, TargetName: policyTargetName(cap, use)}
		for _, concern := range policy.Concerns {
			out = append(out, attachedPolicyConcern{Policy: policy, Use: use, Attachment: attachment, Concern: concern})
		}
	}
	sort.Slice(out, func(i, j int) bool {
		a, b := out[i], out[j]
		return a.Policy.Name+a.Concern.Name < b.Policy.Name+b.Concern.Name
	})
	return out
}

func (c *compiler) policyEventTargets(cap ast.CapabilityDecl) []string {
	seen := map[string]bool{}
	for _, use := range cap.Policies {
		if use.TargetKind == "event" && use.TargetName != "" {
			seen[use.TargetName] = true
		}
	}
	return sortedKeys(seen)
}

func effectiveConcernIR(item attachedPolicyConcern, targetKind, targetSymbol, mode string) ir.EffectiveConcernIR {
	return ir.EffectiveConcernIR{
		Name:                item.Concern.Name,
		Family:              item.Policy.Family,
		TargetKind:          targetKind,
		TargetSymbol:        targetSymbol,
		SourcePolicies:      []string{item.Policy.Name},
		EffectiveParameters: concernIR(item.Policy.Family, item.Concern).Parameters,
		CompositionMode:     mode,
	}
}

func mergeEffectiveConcern(current, next ir.EffectiveConcernIR, result ir.PolicyCompositionResultIR) ir.EffectiveConcernIR {
	switch result.Mode {
	case string(modeAugment):
		current.SourcePolicies = appendUniqueMany(current.SourcePolicies, next.SourcePolicies)
		current.EffectiveParameters = append(current.EffectiveParameters, next.EffectiveParameters...)
		current.CompositionMode = string(modeAugment)
		return current
	case string(modeNarrow):
		next.SourcePolicies = appendUniqueMany(current.SourcePolicies, next.SourcePolicies)
		next.InheritedFrom = current.InheritedFrom
		if next.InheritedFrom == "" {
			next.InheritedFrom = current.TargetKind + ":" + current.TargetSymbol
		}
		next.NarrowedFrom = current.Name
		next.CompositionMode = string(modeNarrow)
		return next
	default:
		return next
	}
}

func compositionResult(concern, targetKind, targetSymbol, mode string, policies []string, result string) ir.PolicyCompositionResultIR {
	sort.Strings(policies)
	return ir.PolicyCompositionResultIR{
		Concern:        concern,
		TargetKind:     targetKind,
		TargetSymbol:   targetSymbol,
		Mode:           mode,
		SourcePolicies: policies,
		Result:         result,
	}
}

func concernCompositionMode(concern string) compositionMode {
	switch concern {
	case "authorization", "audit", "approval", "evidence", "dependency_tolerance":
		return modeAugment
	case "timeout", "idempotency", "degradation", "concurrency", "rate_limit", "queue", "latency", "budget",
		"authentication", "classification", "encryption", "retention", "sensitivity", "masking", "minimization", "deletion":
		return modeNarrow
	case "retry", "backoff", "circuit_breaker", "fallback", "backpressure", "throughput", "compensation":
		return modeTargetLocal
	default:
		return modeConflict
	}
}

func inheritsAcrossBoundary(concern string) bool {
	return concernCompositionMode(concern) != modeTargetLocal
}

func compareConcernStrength(name string, parent, child []ir.ConcernParameterIR) strengthResult {
	if sameConcernParameters(parent, child) {
		return strengthEqual
	}
	switch name {
	case "idempotency", "authentication", "encryption", "masking", "minimization", "deletion":
		return compareOrderedValue(scalarParameterValue(parent), scalarParameterValue(child), map[string]int{"forbidden": 0, "allowed": 1, "required": 2})
	case "degradation", "queue":
		return compareOrderedValue(scalarParameterValue(parent), scalarParameterValue(child), map[string]int{"allowed": 0, "forbidden": 1})
	case "classification":
		return compareOrderedValue(scalarParameterValue(parent), scalarParameterValue(child), map[string]int{"public": 0, "internal": 1, "confidential": 2, "restricted": 3})
	case "sensitivity":
		return compareOrderedValue(scalarParameterValue(parent), scalarParameterValue(child), map[string]int{"none": 0, "personal": 1, "sensitive": 2, "special_category": 3})
	case "timeout", "budget":
		return compareLowerIsStronger(durationMillis(parameterValues(parent)), durationMillis(parameterValues(child)))
	case "latency":
		pv, cv := parameterValues(parent), parameterValues(child)
		if len(pv) != 3 || len(cv) != 3 || pv[0] != cv[0] || pv[1] != "under" || cv[1] != "under" {
			return strengthIncomparable
		}
		return compareLowerIsStronger(durationMillis([]string{pv[2]}), durationMillis([]string{cv[2]}))
	case "concurrency":
		return compareLowerIsStronger(intValue(scalarParameterValue(parent)), intValue(scalarParameterValue(child)))
	case "rate_limit":
		pv, cv := parameterValues(parent), parameterValues(child)
		if len(pv) != 3 || len(cv) != 3 || pv[1] != "per" || cv[1] != "per" || pv[2] != cv[2] {
			return strengthIncomparable
		}
		return compareLowerIsStronger(intValue(pv[0]), intValue(cv[0]))
	case "retention":
		return strengthIncomparable
	default:
		return strengthIncomparable
	}
}

func compareOrderedValue(parent, child string, order map[string]int) strengthResult {
	p, pok := order[parent]
	c, cok := order[child]
	if !pok || !cok {
		return strengthIncomparable
	}
	switch {
	case c == p:
		return strengthEqual
	case c > p:
		return strengthStronger
	default:
		return strengthWeaker
	}
}

func compareLowerIsStronger(parent, child int) strengthResult {
	if parent <= 0 || child <= 0 {
		return strengthIncomparable
	}
	switch {
	case child == parent:
		return strengthEqual
	case child < parent:
		return strengthStronger
	default:
		return strengthWeaker
	}
}

func durationMillis(values []string) int {
	if len(values) == 1 {
		number, unit := splitNumberUnit(values[0])
		return durationUnitMillis(number, unit)
	}
	if len(values) == 2 {
		return durationUnitMillis(values[0], values[1])
	}
	return 0
}

func durationUnitMillis(number, unit string) int {
	n, err := strconv.Atoi(number)
	if err != nil || n <= 0 {
		return 0
	}
	switch unit {
	case "ms", "millisecond", "milliseconds":
		return n
	case "s", "second", "seconds":
		return n * 1000
	case "m", "minute", "minutes":
		return n * 60 * 1000
	case "h", "hour", "hours":
		return n * 60 * 60 * 1000
	default:
		return 0
	}
}

func intValue(value string) int {
	n, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return n
}

func sameConcernParameters(a, b []ir.ConcernParameterIR) bool {
	return parametersKey(a) == parametersKey(b)
}

func parametersKey(params []ir.ConcernParameterIR) string {
	var parts []string
	for _, param := range params {
		parts = append(parts, param.Name+"="+strings.Join(param.Values, ","))
	}
	sort.Strings(parts)
	return strings.Join(parts, ";")
}

func parameterValues(params []ir.ConcernParameterIR) []string {
	for _, param := range params {
		if param.Name == "value" {
			return param.Values
		}
	}
	return nil
}

func scalarParameterValue(params []ir.ConcernParameterIR) string {
	values := parameterValues(params)
	if len(values) == 1 {
		return values[0]
	}
	return ""
}

func parametersText(params []ir.ConcernParameterIR) string {
	var parts []string
	for _, param := range params {
		parts = append(parts, strings.Join(param.Values, " "))
	}
	return strings.TrimSpace(strings.Join(parts, " "))
}

func duplicateConcernDiagnostic(concern string) string {
	switch concern {
	case "timeout":
		return "DCL_SEM_DUPLICATE_EFFECTIVE_TIMEOUT"
	case "retry":
		return "DCL_SEM_DUPLICATE_EFFECTIVE_RETRY"
	default:
		return "DCL_SEM_CONFLICTING_POLICY_CONCERN"
	}
}

func weakeningDiagnostic(concern string) string {
	switch concern {
	case "timeout", "concurrency", "rate_limit", "latency", "budget":
		return "DCL_SEM_POLICY_NARROWING_VIOLATION"
	default:
		return "DCL_SEM_POLICY_WEAKENED_GUARANTEE"
	}
}

func incomparableDiagnostic(concern string) string {
	switch concern {
	case "rate_limit":
		return "DCL_SEM_RATE_LIMIT_UNITS_INCOMPARABLE"
	case "retention":
		return "DCL_SEM_RETENTION_COMPARISON_UNSAFE"
	default:
		return "DCL_SEM_INCOMPARABLE_POLICY_TARGETS"
	}
}

func policyObligations(concern ir.EffectiveConcernIR) []ir.PolicyObligationIR {
	var out []ir.PolicyObligationIR
	for _, policy := range concern.SourcePolicies {
		out = append(out, ir.PolicyObligationIR{
			SourcePolicy:             policy,
			SourceConcern:            concern.Name,
			TargetKind:               concern.TargetKind,
			TargetSymbol:             concern.TargetSymbol,
			CompilerObligations:      compilerObligations(concern.Name),
			RuntimeObligations:       runtimeObligations(concern.Name),
			ObservabilityObligations: observabilityObligations(concern.Name),
			VerificationObligations:  verificationObligations(concern.Name),
		})
	}
	return out
}

func compilerObligations(concern string) []string {
	switch concern {
	case "retry":
		return []string{"validate retry target", "validate attempts", "validate idempotency compatibility", "validate retry exhaustion causation if declared"}
	case "timeout":
		return []string{"validate duration", "validate timeout composition", "validate timeout causation if declared"}
	case "authorization":
		return []string{"validate attachment target", "validate authorization concern", "validate denial causation if declared"}
	case "circuit_breaker":
		return []string{"validate effect attachment", "validate opening threshold", "validate reset duration", "validate open-state causation if declared"}
	default:
		return []string{"validate policy concern", "validate effective policy composition"}
	}
}

func runtimeObligations(concern string) []string {
	switch concern {
	case "retry":
		return []string{"retry declared retryable resolution paths", "stop after configured attempts", "surface final resolution"}
	case "timeout":
		return []string{"enforce timeout at target boundary", "preserve explicit outcome behavior"}
	case "authorization":
		return []string{"evaluate authorization before protected behavior progresses", "surface denial as policy resolution"}
	case "circuit_breaker":
		return []string{"prevent repeated unhealthy dependency invocation", "surface open state"}
	default:
		return []string{"surface policy resolution without implicit outcomes"}
	}
}

func observabilityObligations(concern string) []string {
	switch concern {
	case "retry":
		return []string{"emit attempt count", "emit retry exhaustion", "correlate all attempts"}
	case "timeout":
		return []string{"emit timeout occurrence", "emit elapsed duration", "correlate timeout to target boundary"}
	case "authorization":
		return []string{"emit policy decision", "emit actor/context correlation", "avoid leaking sensitive data"}
	case "circuit_breaker":
		return []string{"emit circuit open signal", "emit blocked attempts", "emit reset timing"}
	default:
		return []string{"emit policy decision signal"}
	}
}

func verificationObligations(concern string) []string {
	switch concern {
	case "retry":
		return []string{"test success after retry", "test retry exhaustion", "test non-retryable failure does not retry"}
	case "timeout":
		return []string{"test successful execution within timeout", "test timeout path", "test timeout causation if declared"}
	case "authorization":
		return []string{"test allowed path", "test denied path", "test denial causation if declared"}
	case "circuit_breaker":
		return []string{"test circuit opens after threshold", "test open circuit causation if declared", "test reset timing is represented"}
	case "fallback":
		return []string{"test fallback path is explicit", "test fallback does not silently select an outcome"}
	default:
		return []string{"test effective policy behavior"}
	}
}

func normalizePolicyState(state string) string {
	if state == "denied" {
		return "denies"
	}
	return state
}

func policyStateConcern(state, policy string, envelopes []ir.EffectivePolicyIR) (string, ir.EffectivePolicyIR, bool) {
	for _, env := range envelopes {
		for _, concern := range env.EffectiveConcerns {
			if !contains(concern.SourcePolicies, policy) {
				continue
			}
			if policyConcernCanProduceState(concern.Name, state) {
				return concern.Name, env, true
			}
		}
	}
	return "", ir.EffectivePolicyIR{}, false
}

func policyConcernCanProduceState(concern, state string) bool {
	switch state {
	case "denies":
		return concern == "authorization"
	case "exhausted":
		return concern == "retry"
	case "times_out":
		return concern == "timeout"
	case "open":
		return concern == "circuit_breaker"
	case "degraded":
		return concern == "degradation"
	case "fallback_used":
		return concern == "fallback"
	default:
		return false
	}
}

func knownPolicyState(state string) bool {
	switch state {
	case "denies", "exhausted", "times_out", "open", "degraded", "fallback_used":
		return true
	default:
		return false
	}
}

func appendUnique(items []string, item string) []string {
	if item == "" || contains(items, item) {
		return items
	}
	return append(items, item)
}

func appendUniqueMany(items []string, more []string) []string {
	for _, item := range more {
		items = appendUnique(items, item)
	}
	sort.Strings(items)
	return items
}

func sortEnvelope(env *ir.EffectivePolicyIR) {
	sort.Strings(env.AppliedPolicies)
	sort.Slice(env.EffectiveConcerns, func(i, j int) bool {
		return env.EffectiveConcerns[i].Name < env.EffectiveConcerns[j].Name
	})
	sort.Slice(env.CompositionResults, func(i, j int) bool {
		a, b := env.CompositionResults[i], env.CompositionResults[j]
		return a.Concern+a.TargetKind+a.TargetSymbol < b.Concern+b.TargetKind+b.TargetSymbol
	})
	sort.Slice(env.Conflicts, func(i, j int) bool {
		a, b := env.Conflicts[i], env.Conflicts[j]
		return a.Concern+a.TargetKind+a.TargetSymbol < b.Concern+b.TargetKind+b.TargetSymbol
	})
	sort.Slice(env.Obligations, func(i, j int) bool {
		a, b := env.Obligations[i], env.Obligations[j]
		return a.SourcePolicy+a.SourceConcern+a.TargetKind+a.TargetSymbol < b.SourcePolicy+b.SourceConcern+b.TargetKind+b.TargetSymbol
	})
	sort.Slice(env.Causations, func(i, j int) bool {
		a, b := env.Causations[i], env.Causations[j]
		return a.Policy+a.State+a.Outcome < b.Policy+b.State+b.Outcome
	})
}

func sortEffectivePolicyIR(items []ir.EffectivePolicyIR) {
	sort.Slice(items, func(i, j int) bool {
		return items[i].ID < items[j].ID
	})
}
