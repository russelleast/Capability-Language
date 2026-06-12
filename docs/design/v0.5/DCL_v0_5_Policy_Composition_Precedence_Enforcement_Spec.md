# Declarative Capability Language v0.5 — Policy Composition, Precedence & Enforcement Semantics

## Status

Proposed implementation specification for DCL v0.5.

This document is intended to guide implementation in the Go compiler using Codex.

---

## Decision

DCL v0.5 will focus on **policy composition, precedence, and enforcement semantics**.

DCL v0.4 made policy concerns first-class compiler-verifiable declarations. v0.5 defines how those declared policies interact when multiple policies apply to the same capability boundary.

v0.5 introduces a compiler-derived concept:

```text
EffectivePolicyEnvelope
```

An `EffectivePolicyEnvelope` is not authored directly. It is derived by the compiler from declared policies, attachment points, policy families, concerns, precedence rules, and conflict rules.

---

## One-line model

> DCL v0.5 derives an effective policy envelope for each capability boundary so policy concerns are not only declared, but composed, checked, and enforceable.

---

## Why this release exists

After v0.4, DCL can express policy families and concerns such as:

- reliability
- availability
- scalability
- performance
- security
- compliance / governance
- data protection

and concerns such as:

- retry
- timeout
- idempotency
- circuit_breaker
- fallback
- latency
- authorization
- audit
- retention
- masking

However, v0.4 does not fully answer what happens when multiple policies apply at different boundaries.

Example:

```dcl
policy RegisterCustomerReliability {
  family reliability
  timeout 30s
}

policy PaymentGatewayReliability {
  family reliability
  timeout 5s
  retry { attempts 3 }
}

capability RegisterCustomer {
  policies {
    RegisterCustomerReliability governs capability
    PaymentGatewayReliability governs effect CallPaymentGateway
  }
}
```

The compiler must be able to answer:

- Does the effect timeout override the capability timeout?
- Does it narrow the capability timeout?
- Are both timeouts valid together?
- Which retry applies to the effect?
- Is the effective envelope portable?
- What runtime behavior must be generated?
- What verification cases must be generated?

v0.5 resolves this gap.

---

## Scope

v0.5 includes:

1. Effective policy envelope derivation
2. Policy attachment resolution
3. Policy precedence rules
4. Policy composition rules
5. Conflict diagnostics
6. Policy-caused outcome semantics
7. Effective policy IR
8. Derived compiler/runtime/observability/verification obligations

v0.5 does not add new policy families or concern vocabulary.

---

## Non-goals

v0.5 must not introduce:

- new policy families
- new concern taxonomy
- context-level policy inheritance
- deployment profiles
- environment-specific activation
- Kubernetes, service mesh, cloud, or vendor-specific mappings
- runtime adapter configuration
- OAuth provider setup
- firewall or certificate configuration
- legal/compliance engine semantics
- generated runtime adapters as policy meaning

Policy remains a language-level declaration of portable capability execution qualities.

---

## Existing v0.4 baseline

v0.5 assumes v0.4 already supports:

- `policy` declarations
- `family` declarations
- concern parsing
- concern validation
- `ConcernIR`
- policy attachment syntax
- diagnostics for malformed concerns
- concern/family compatibility checks

Example v0.4 policy:

```dcl
policy RegisterCustomerReliability {
  family reliability

  retry {
    attempts 3
    backoff exponential
  }

  timeout 30s
  idempotency required
}
```

Example v0.4 attachment:

```dcl
policies {
  RegisterCustomerReliability governs capability
  PaymentDependencyProtection governs effect CallPaymentGateway
}
```

v0.5 builds on this; it does not replace it.

---

# 1. Core concept: EffectivePolicyEnvelope

## Definition

An `EffectivePolicyEnvelope` is the compiler-derived policy model for a specific semantic boundary.

Supported v0.5 boundaries:

- capability
- effect
- outcome
- event
- lifecycle

Lifecycle transition-level policies may be represented if already supported internally, but are not required for v0.5 unless the existing compiler already models them.

## Purpose

The effective envelope answers:

- which policies apply to this boundary
- which concerns are active
- how concerns compose
- whether conflicts exist
- what obligations are derived
- whether the target runtime can support the envelope

## Authored vs derived

Authors declare policies and attachments.

The compiler derives effective envelopes.

Authors do not write:

```dcl
EffectivePolicyEnvelope
```

or any equivalent source construct.

---

# 2. Attachment resolution

## Supported attachment targets

v0.5 uses the v0.4 supported attachment pattern:

```dcl
policies {
  PolicyName governs capability
  PolicyName governs effect EffectName
  PolicyName governs outcome OutcomeName
  PolicyName governs event EventName
  PolicyName governs lifecycle
}
```

## Attachment identity

Each policy attachment resolves to:

```text
PolicyAttachment
- policy
- target_kind
- target_symbol
- containing_capability
- source_location
```

Examples:

```dcl
RegisterCustomerReliability governs capability
```

resolves to:

```text
policy: RegisterCustomerReliability
target_kind: capability
target_symbol: RegisterCustomer
```

```dcl
PaymentReliability governs effect CallPaymentGateway
```

resolves to:

```text
policy: PaymentReliability
target_kind: effect
target_symbol: CallPaymentGateway
containing_capability: RegisterCustomer
```

## Attachment validation

The compiler must continue to validate:

- referenced policy exists
- referenced target exists
- target kind is supported
- policy concerns are valid for the target
- special-case concern constraints still apply

Example:

`circuit_breaker` remains valid only for an effect-governing reliability policy.

---

# 3. Policy boundary model

## Boundary hierarchy

v0.5 defines the following semantic boundary nesting:

```text
capability
  ├── intent      [reserved / optional in v0.5]
  ├── effect
  ├── outcome
  ├── event
  └── lifecycle
```

For v0.5 implementation, the required hierarchy is:

```text
capability
  ├── effect
  ├── outcome
  ├── event
  └── lifecycle
```

## Important rule

A narrower boundary does not erase the wider boundary unless a concern explicitly supports replacement semantics.

Most concerns either:

- augment
- narrow
- conflict

True override should be rare and compiler-controlled.

---

# 4. Composition model

Each concern participates in one of these composition modes:

| Mode | Meaning |
|---|---|
| `augment` | Adds additional obligations without replacing wider obligations |
| `narrow` | Makes a guarantee stricter at a narrower boundary |
| `override` | Replaces a wider concern at a narrower boundary where explicitly allowed |
| `conflict` | Invalid combination |

The compiler derives the composition mode. Authors do not write `augment`, `narrow`, `override`, or `conflict` in source for v0.5.

---

# 5. Default composition rules by concern

The following v0.5 rules are deliberately conservative.

## Reliability

### `timeout`

Composition: `narrow` or `conflict`

Rules:

- A narrower boundary may declare a shorter timeout than the wider boundary.
- A narrower boundary must not declare a longer timeout than the enclosing capability timeout.
- Two timeouts attached to the same exact target conflict unless identical.

Example valid:

```dcl
policy CapabilityTimeout {
  family reliability
  timeout 30s
}

policy PaymentTimeout {
  family reliability
  timeout 5s
}

capability RegisterCustomer {
  policies {
    CapabilityTimeout governs capability
    PaymentTimeout governs effect CallPaymentGateway
  }
}
```

Meaning:

```text
Capability timeout: 30s
CallPaymentGateway timeout: 5s
```

Example invalid:

```dcl
policy CapabilityTimeout {
  family reliability
  timeout 30s
}

policy PaymentTimeout {
  family reliability
  timeout 60s
}

capability RegisterCustomer {
  policies {
    CapabilityTimeout governs capability
    PaymentTimeout governs effect CallPaymentGateway
  }
}
```

Diagnostic:

```text
ERROR: effect timeout 60s exceeds enclosing capability timeout 30s for effect CallPaymentGateway
```

### `retry`

Composition: `target-local` or `conflict`

Rules:

- Retry applies to the boundary it governs.
- Effect-level retry governs effect resolution.
- Capability-level retry governs the capability attempt only if the compiler/runtime supports whole-capability retry semantics.
- Multiple retry concerns on the same target conflict unless identical.
- Retry requires idempotency compatibility on the same target or inherited from a wider compatible envelope.

Example invalid:

```dcl
policy RetryA {
  family reliability
  retry { attempts 3 }
}

policy RetryB {
  family reliability
  retry { attempts 5 }
}

capability RegisterCustomer {
  policies {
    RetryA governs effect SendVerification
    RetryB governs effect SendVerification
  }
}
```

Diagnostic:

```text
ERROR: conflicting retry concerns on effect SendVerification
```

### `backoff`

Composition: part of retry

Rules:

- `backoff` must remain associated with a retry concern.
- Multiple backoff strategies for the same effective retry conflict.

### `idempotency`

Composition: `narrow` or `conflict`

Ordering of strictness:

```text
required > allowed > forbidden
```

Rules:

- A narrower boundary may strengthen idempotency from `allowed` to `required`.
- A narrower boundary may not weaken `required` to `allowed` or `forbidden`.
- `retry` is incompatible with effective `idempotency forbidden`.

Example invalid:

```dcl
policy NoIdempotency {
  family reliability
  idempotency forbidden
}

policy RetryEmail {
  family reliability
  retry { attempts 3 }
}

capability RegisterCustomer {
  policies {
    NoIdempotency governs effect SendVerification
    RetryEmail governs effect SendVerification
  }
}
```

Diagnostic:

```text
ERROR: retry requires idempotency allowed or required on effect SendVerification
```

### `circuit_breaker`

Composition: `target-local` or `conflict`

Rules:

- Valid only on effect-governing reliability policies.
- Multiple circuit breakers on the same effect conflict unless identical.
- Circuit breaker does not compose upward to the capability.
- Circuit breaker may cause policy outcomes only through explicit `when` causation.

---

## Availability

### `fallback`

Composition: `target-local` or `conflict`

Rules:

- A fallback must reference an outcome declared by the containing capability.
- Multiple different fallbacks on the same target conflict.
- Fallback does not implicitly select an outcome.
- Fallback-caused outcome selection must be explicit in `when`.

### `degradation`

Composition: `narrow` or `conflict`

Ordering:

```text
forbidden > allowed
```

Rules:

- If degradation is forbidden at capability level, narrower boundaries may not allow it.
- If degradation is allowed at capability level, narrower boundaries may forbid it.

### `dependency_tolerance`

Composition: `augment` / `narrow`

Rules:

- `required` creates an obligation that dependency failure must be represented through declared outcomes or explicit failure semantics.
- It does not define infrastructure behavior.

---

## Scalability

### `concurrency`

Composition: `narrow` or `conflict`

Rules:

- Narrower boundary concurrency must be less than or equal to enclosing concurrency.
- Same-target differing concurrency values conflict.

### `rate_limit`

Composition: `narrow` or `conflict`

Rules:

- Narrower boundary rate limits must be less than or equal to enclosing rate limits when units are comparable.
- If units are not comparable, emit a warning or target-specific diagnostic.
- Same-target differing rate limits conflict unless identical.

### `queue`

Composition: `narrow` or `conflict`

Ordering:

```text
forbidden > allowed
```

Rules:

- A narrower boundary may forbid queueing if wider allows it.
- A narrower boundary may not allow queueing if wider forbids it.

### `backpressure`

Composition: `target-local` or `conflict`

Rules:

- Multiple different backpressure strategies on the same target conflict.
- Backpressure strategies may require declared outcomes if they defer or reject execution.

---

## Performance

### `latency`

Composition: `narrow` or `conflict`

Rules:

- Narrower latency targets must be stricter than or equal to enclosing targets where comparable.
- Same-target differing latency targets conflict unless identical.

### `throughput`

Composition: `augment` / `target-local`

Rules:

- Capability-level throughput describes the capability boundary.
- Effect-level throughput describes the effect boundary.
- Do not automatically compare throughput across different boundary kinds unless the compiler has explicit comparable units.

### `budget`

Composition: `narrow` or `conflict`

Rules:

- Narrower budget must not exceed enclosing budget.
- Same-target differing budgets conflict unless identical.

---

## Security

### `authentication`

Composition: `narrow` or `conflict`

Ordering:

```text
required > allowed > forbidden
```

Rules:

- Narrower boundary may strengthen authentication.
- Narrower boundary may not weaken required authentication.

### `authorization`

Composition: `augment` / `narrow`

Rules:

- Multiple authorization requirements may compose as additional obligations.
- An authorization denial may cause an outcome only through explicit `when` causation.

### `classification`

Composition: `narrow` or `conflict`

Rules:

- Narrower boundary may increase classification sensitivity.
- Narrower boundary may not reduce classification sensitivity.
- Compiler-known classification ordering is required.

### `encryption`

Composition: `narrow` or `conflict`

Ordering:

```text
required > allowed > forbidden
```

Rules:

- Narrower boundary may strengthen encryption.
- Narrower boundary may not weaken required encryption.

---

## Compliance / Governance

### `audit`

Composition: `augment` / `narrow`

Rules:

- Audit requirements accumulate.
- Narrower boundaries may require more audit evidence.
- Audit does not define logging implementation.

### `retention`

Composition: `narrow` or `conflict`

Rules:

- Same-target retention conflicts unless identical.
- Cross-boundary retention should be checked conservatively.
- The compiler may warn when retention semantics cannot be compared safely.

### `approval`

Composition: `augment`

Rules:

- Approval requirements accumulate.
- Approval-required paths must be represented explicitly in capability behavior or lifecycle semantics where relevant.

### `evidence`

Composition: `augment`

Rules:

- Evidence requirements accumulate.
- Derived obligations must include verification and observability evidence.

---

## Data protection

### `sensitivity`

Composition: `narrow` or `conflict`

Rules:

- Narrower boundary may increase sensitivity.
- Narrower boundary may not reduce sensitivity.
- Compiler-known sensitivity ordering is required.

### `masking`

Composition: `narrow` or `conflict`

Ordering:

```text
required > allowed > forbidden
```

### `minimization`

Composition: `narrow` or `conflict`

Ordering:

```text
required > allowed > forbidden
```

### `retention`

Composition: same as compliance retention

### `deletion`

Composition: `narrow` or `conflict`

Ordering:

```text
required > allowed > forbidden
```

---

# 6. Policy causation

## Principle

A policy may influence outcome selection only through explicit causation.

No policy may silently select an outcome.

This preserves the DCL causation model:

```text
Outcome must be selected because of explicitly declared causes.
```

## Supported policy causation forms

v0.5 should support `when` branches for policy resolution states where practical.

Preferred authored form:

```dcl
when {
  policy CustomerSecurity denies then NotAllowed
  policy PaymentReliability exhausted then PaymentDeferred
  policy PaymentDependencyProtection open then PaymentDeferred
  otherwise then Accepted
}
```

If the current compiler still uses `=>` for `when`, support the existing surface form consistently:

```dcl
when {
  policy CustomerSecurity denies => NotAllowed
  policy PaymentReliability exhausted => PaymentDeferred
  policy PaymentDependencyProtection open => PaymentDeferred
  otherwise => Accepted
}
```

Implementation should follow the current parser direction in the repository.

## Policy resolution states

Minimum policy resolution states for v0.5:

| State | Meaning |
|---|---|
| `denies` | Authorization or access policy denies execution |
| `exhausted` | Retry or recovery attempts are exhausted |
| `times_out` | Timeout is exceeded |
| `open` | Circuit breaker is open |
| `degraded` | Degraded path is used |
| `fallback_used` | Fallback path is used |

The compiler should only allow states compatible with the policy concerns present.

Examples:

- `denies` requires authorization/security concern
- `exhausted` requires retry or recovery-like concern
- `times_out` requires timeout concern
- `open` requires circuit_breaker concern
- `fallback_used` requires fallback concern

## Diagnostics

Invalid:

```dcl
policy CustomerSecurity {
  family security
  authorization required
}

when {
  policy CustomerSecurity exhausted then Deferred
}
```

Diagnostic:

```text
ERROR: policy CustomerSecurity cannot produce state exhausted because it has no retry-like concern
```

Invalid:

```dcl
policy PaymentReliability {
  family reliability
  retry { attempts 3 }
}

when {
  policy PaymentReliability denies then NotAllowed
}
```

Diagnostic:

```text
ERROR: policy PaymentReliability cannot produce state denies because it has no authorization concern
```

---

# 7. EffectivePolicyIR

v0.5 adds derived IR structures.

## EffectivePolicyIR

```text
EffectivePolicyIR
- id
- target_kind
- target_symbol
- containing_capability
- applied_policies
- effective_concerns
- composition_results
- conflicts
- obligations
- portability
- source_locations
```

## EffectiveConcernIR

```text
EffectiveConcernIR
- name
- family
- target_kind
- target_symbol
- source_policies
- effective_parameters
- composition_mode
- inherited_from
- narrowed_from
- overrides
- diagnostics
```

## PolicyCompositionResultIR

```text
PolicyCompositionResultIR
- concern
- target
- mode
- source_policies
- result
- diagnostics
```

## PolicyObligationIR

```text
PolicyObligationIR
- source_policy
- source_concern
- target_kind
- target_symbol
- compiler_obligations
- runtime_obligations
- observability_obligations
- verification_obligations
```

## PolicyCausationIR

```text
PolicyCausationIR
- policy
- concern
- state
- outcome
- target
- source_location
```

---

# 8. Derived obligations

Every effective concern should derive obligations.

The compiler does not need to generate runtime code in v0.5, but it must produce the normalized obligation model or diagnostics needed by later generation.

## Example: retry

Compiler obligations:

- validate retry target
- validate attempts
- validate backoff relationship
- validate idempotency compatibility
- validate retry exhaustion outcome if referenced in `when`

Runtime obligations:

- retry only declared retryable resolution paths
- stop after configured attempts
- preserve correlation across attempts
- surface final resolution

Observability obligations:

- emit attempt count
- emit retry exhaustion
- correlate all attempts
- record final selected outcome

Verification obligations:

- test success after retry
- test retry exhaustion
- test non-retryable failure does not retry

## Example: timeout

Compiler obligations:

- validate duration
- validate timeout composition
- validate timeout-caused outcome if declared

Runtime obligations:

- enforce timeout at target boundary
- stop or classify work according to target runtime semantics
- preserve explicit outcome behavior

Observability obligations:

- emit timeout occurrence
- emit elapsed duration
- correlate timeout to capability/effect boundary

Verification obligations:

- test timeout path
- test successful execution within timeout
- test timeout outcome causation if declared

## Example: authorization

Compiler obligations:

- validate attachment target
- validate authorization concern
- validate denial outcome if referenced

Runtime obligations:

- evaluate authorization before protected behavior progresses
- surface denial as policy resolution

Observability obligations:

- emit policy decision
- emit actor/context correlation
- avoid leaking sensitive data

Verification obligations:

- test allowed actor path
- test denied actor path
- test denial outcome causation if declared

## Example: circuit_breaker

Compiler obligations:

- validate effect attachment
- validate opening threshold
- validate reset duration
- validate open-state outcome if referenced

Runtime obligations:

- prevent repeated unhealthy dependency invocation
- surface open state
- preserve effect resolution semantics

Observability obligations:

- emit circuit open event/signal
- emit blocked attempts
- emit reset timing

Verification obligations:

- test circuit opens after threshold
- test open circuit causes declared outcome where authored
- test reset timing is represented

---

# 9. Diagnostics

v0.5 adds the following diagnostic categories.

## Policy composition diagnostics

```text
ERROR: conflicting_policy_concern
ERROR: policy_narrowing_violation
ERROR: policy_weakened_guarantee
ERROR: duplicate_policy_concern
ERROR: incompatible_policy_combination
ERROR: unsupported_policy_composition
```

## Policy causation diagnostics

```text
ERROR: invalid_policy_causation_state
ERROR: policy_causation_without_matching_concern
ERROR: policy_causation_references_unknown_policy
ERROR: policy_causation_references_unattached_policy
ERROR: policy_causation_outcome_missing
```

## Effective envelope diagnostics

```text
ERROR: effective_policy_conflict
WARNING: degraded_policy_portability
WARNING: incomparable_policy_targets
INFO: effective_policy_derived
```

---

# 10. Compiler algorithm

Implementation should add a policy composition pass after v0.4 policy validation.

Recommended pass order:

1. Parse source
2. Resolve symbols
3. Validate primitive contracts
4. Validate policy declarations
5. Validate concern/family compatibility
6. Resolve policy attachments
7. Build initial policy attachment map
8. Derive effective policy envelopes
9. Compose concerns
10. Detect conflicts
11. Validate policy causation in `when`
12. Derive policy obligations
13. Attach `EffectivePolicyIR` to ProgramIR / CapabilityIR
14. Emit diagnostics

Pseudo-code:

```text
for each capability:
  capabilityEnvelope = deriveEnvelope(capability)

  for each effect in capability.effects:
    effectEnvelope = deriveEnvelope(effect, parent = capabilityEnvelope)

  for each outcome in capability.outcomes:
    outcomeEnvelope = deriveEnvelope(outcome, parent = capabilityEnvelope)

  for each event in capability.events:
    eventEnvelope = deriveEnvelope(event, parent = capabilityEnvelope)

  if capability.lifecycle exists:
    lifecycleEnvelope = deriveEnvelope(lifecycle, parent = capabilityEnvelope)

  validatePolicyCausation(capability.when, allEnvelopes)
```

---

# 11. Examples

## Example A — valid effect timeout narrowing

```dcl
policy CapabilityReliability {
  family reliability
  timeout 30s
}

policy PaymentReliability {
  family reliability
  timeout 5s
  retry { attempts 3 }
  idempotency required
}

capability RegisterCustomer {
  intent RegisterCustomerInput from Customer

  outcomes {
    Accepted
    PaymentDeferred
  }

  effect CallPaymentGateway {
    kind invoke
  }

  policies {
    CapabilityReliability governs capability
    PaymentReliability governs effect CallPaymentGateway
  }

  when {
    policy PaymentReliability exhausted then PaymentDeferred
    otherwise then Accepted
  }
}
```

Expected:

```text
PASS
Effective capability timeout: 30s
Effective CallPaymentGateway timeout: 5s
Effective CallPaymentGateway retry attempts: 3
```

---

## Example B — invalid effect timeout widening

```dcl
policy CapabilityReliability {
  family reliability
  timeout 30s
}

policy SlowEffectReliability {
  family reliability
  timeout 60s
}

capability RegisterCustomer {
  intent RegisterCustomerInput from Customer
  outcomes { Accepted Deferred }
  effect CallPaymentGateway { kind invoke }

  policies {
    CapabilityReliability governs capability
    SlowEffectReliability governs effect CallPaymentGateway
  }

  when {
    otherwise then Accepted
  }
}
```

Expected diagnostic:

```text
ERROR: policy_narrowing_violation: effect timeout 60s exceeds enclosing capability timeout 30s for effect CallPaymentGateway
```

---

## Example C — authorization denial must be explicit

```dcl
policy CustomerSecurity {
  family security
  authorization required
}

capability RegisterCustomer {
  intent RegisterCustomerInput from Customer

  outcomes {
    Accepted
    NotAllowed
  }

  policies {
    CustomerSecurity governs capability
  }

  when {
    policy CustomerSecurity denies then NotAllowed
    otherwise then Accepted
  }
}
```

Expected:

```text
PASS
Policy causation: CustomerSecurity denies -> NotAllowed
```

---

## Example D — invalid policy causation state

```dcl
policy CustomerSecurity {
  family security
  authorization required
}

capability RegisterCustomer {
  intent RegisterCustomerInput from Customer
  outcomes { Accepted Deferred }

  policies {
    CustomerSecurity governs capability
  }

  when {
    policy CustomerSecurity exhausted then Deferred
    otherwise then Accepted
  }
}
```

Expected diagnostic:

```text
ERROR: invalid_policy_causation_state: policy CustomerSecurity cannot produce exhausted because no retry-like concern is present
```

---

## Example E — circuit breaker effect protection

```dcl
policy PaymentDependencyProtection {
  family reliability

  circuit_breaker {
    opens after 5 failures
    resets after 30s
  }
}

capability RegisterCustomer {
  intent RegisterCustomerInput from Customer

  outcomes {
    Accepted
    PaymentDeferred
  }

  effect CallPaymentGateway {
    kind invoke
  }

  policies {
    PaymentDependencyProtection governs effect CallPaymentGateway
  }

  when {
    policy PaymentDependencyProtection open then PaymentDeferred
    otherwise then Accepted
  }
}
```

Expected:

```text
PASS
Effective effect envelope includes circuit_breaker
Policy causation: open -> PaymentDeferred
```

---

# 12. Testing requirements

Codex implementation should include tests for:

## Positive tests

- capability-level policy envelope derivation
- effect-level policy envelope derivation
- valid timeout narrowing
- valid idempotency strengthening
- valid authorization denial causation
- valid retry exhaustion causation
- valid circuit breaker open causation
- obligation derivation for retry
- obligation derivation for timeout

## Negative tests

- duplicate conflicting timeout on same target
- effect timeout wider than capability timeout
- retry with idempotency forbidden
- circuit_breaker governing capability
- policy causation with unsupported state
- policy causation referencing unattached policy
- policy causation referencing missing outcome
- fallback referencing missing outcome

## Snapshot / golden tests

Add golden IR tests for:

- `EffectivePolicyIR`
- `EffectiveConcernIR`
- `PolicyObligationIR`
- `PolicyCausationIR`

---

# 13. Implementation guidance for Codex

The implementation should be incremental.

Recommended tasks:

1. Inspect existing policy AST and IR from v0.4.
2. Add derived IR structs for effective policy envelopes.
3. Add policy attachment resolution map if not already present.
4. Add a policy composition analysis pass.
5. Implement conservative composition rules for reliability first.
6. Extend to remaining families using table-driven rules.
7. Add policy causation validation in `when` blocks.
8. Add diagnostics.
9. Add positive and negative tests.
10. Add golden IR snapshots.
11. Update examples and cheat sheet.

Do not rewrite parser architecture unless necessary.

Do not introduce runtime-specific concerns.

Do not add context policy inheritance in this release.

---

# 14. Acceptance criteria

v0.5 is complete when:

- policies can still be parsed as in v0.4
- policy attachments resolve to concrete semantic targets
- effective policy envelopes are derived per capability boundary
- concern composition is deterministic
- invalid combinations produce diagnostics
- valid narrowing/augmentation succeeds
- policy causation is validated against policy concerns
- effective policy IR is emitted
- obligations are represented in IR or diagnostics
- tests cover positive, negative, and golden IR cases
- documentation explains v0.5 semantics and non-goals

---

# 15. Design guardrail

If a proposed change requires the language to know about Kubernetes, Azure, AWS, Istio, Envoy, OAuth provider configuration, queues as products, autoscaling resources, or deployment topology, it is out of scope for v0.5.

The language declares capability execution qualities.

Runtime and infrastructure remain projections.

---

## Summary

DCL v0.5 turns policy from validated declaration into derived execution meaning.

It defines how policy concerns compose into effective envelopes, how conflicts are detected, how policy can explicitly cause outcomes, and what obligations the compiler must expose for runtime, observability, and verification.

This keeps DCL capability-first while making policy strong enough to guide implementation, testing, and operational architecture.

