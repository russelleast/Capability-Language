package compiler

const (
	targetCapability = "capability"
	targetEffect     = "effect"
	targetOutcome    = "outcome"
	targetEvent      = "event"
	targetLifecycle  = "lifecycle"
)

const (
	observationCount       = "count"
	observationDuration    = "duration"
	observationViolations  = "violations"
	observationFailures    = "failures"
	observationTransitions = "transitions"
)

const (
	lifecycleKindActive   = "active"
	lifecycleKindWaiting  = "waiting"
	lifecycleKindDecision = "decision"
	lifecycleKindRecovery = "recovery"
	lifecycleKindTerminal = "terminal"
)

const (
	policyStateDenies       = "denies"
	policyStateExhausted    = "exhausted"
	policyStateTimesOut     = "times_out"
	policyStateOpen         = "open"
	policyStateDegraded     = "degraded"
	policyStateFallbackUsed = "fallback_used"
)
