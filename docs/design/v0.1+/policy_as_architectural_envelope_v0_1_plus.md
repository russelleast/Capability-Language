# Declarative Capability Language — Policy as Architectural Envelope v0.1

## Overview

This document defines **policy as architectural envelope** in the Declarative Capability Language (DCL).

It extends the current understanding of policy beyond a simple execution modifier.
In DCL, policy is the mechanism by which **operational architecture becomes explicit, attachable, enforceable, observable, and verifiable**.

This is a **semantics-first** design note.
It does not define final syntax.
It defines what policy means when attached to a capability or other semantic boundary, and what the compiler and runtime must derive from that meaning.

---

## Why this matters

In most codebases, operational concerns such as:

- retries
- timeouts
- structured logging
- tracing
- metrics
- audit
- consistency controls
- security controls

are scattered across middleware, decorators, interceptors, framework conventions, deployment configuration, and handwritten code.

This causes:

- hidden behavior
- inconsistent observability
- duplicated implementation
- weak traceability
- drift between business logic and operational behavior

DCL should treat these concerns as part of the declared system, not as accidental infrastructure.

---

## Core Principle

**Policy is the declarative architectural envelope around semantic behavior.**

A policy does not define business meaning.
A policy defines how execution must behave around that meaning.

When attached to a capability, effect, intent, outcome, event, lifecycle, or transition, a policy causes the compiler and runtime to derive an execution envelope appropriate to that attachment point.

That envelope may include:

- execution control
- visibility requirements
- assurance requirements
- verification obligations
- portability constraints

---

## Design Goal

Policy should make architecture:

- explicit in source
- analyzable by the compiler
- consistently realized in generated code
- consistently surfaced in diagrams
- testable through generated verification scenarios
- portable across runtime targets where possible

---

## Policy is not business logic

Policy must not silently redefine business meaning.

Policy may:

- constrain execution
- deny execution
- retry execution
- observe execution
- classify execution
- require evidence about execution

Policy must not:

- invent undeclared business outcomes
- hide effect behavior
- change capability meaning implicitly
- rely on runtime magic that is absent from source

Where policy influences outcome selection, that influence must be explicit and causally traceable.

---

## Architectural Envelope

### Definition

An **architectural envelope** is the derived operational structure that surrounds a semantic boundary and governs how that boundary executes, is observed, and is verified.

A policy creates an architectural envelope at its declared attachment point.

### Examples

A policy attached to a capability may derive:

- start/end tracing
- latency measurement
- retry behavior
- structured logging
- audit records
- concurrency control
- authorization checks
- timeout handling
- SLO measurement

A policy attached to an effect may derive:

- retry behavior for effect resolution
- idempotency enforcement
- target-specific resilience behavior
- effect latency measurement
- effect-specific structured logs
- compensation expectations

---

## Attachment Semantics

Policies attach explicitly to one or more of the following:

- capability
- intent
- outcome
- effect
- event
- lifecycle
- lifecycle transition

Each attachment point defines a distinct semantic execution boundary.

### 1. Capability attachment

A capability-attached policy governs the whole execution of the capability attempt.

Examples:

- retry the whole capability under specific failure conditions
- capture start/end logs and metrics for each capability attempt
- enforce end-to-end timeout
- require audit visibility for all executions
- enforce authorization before capability progression

### 2. Intent attachment

An intent-attached policy governs the handling of a specific declared attempt.

Examples:

- actor-specific authorization
- rate limiting for one intent shape
- additional audit requirements on sensitive intents

### 3. Outcome attachment

An outcome-attached policy governs operational behavior associated with a selected outcome.

Examples:

- audit all failure outcomes
- retain deferred outcomes differently
- emit additional observability signals on specific outcomes

### 4. Effect attachment

An effect-attached policy governs effect resolution and execution conditions.

Examples:

- retry a notification effect up to three times
- enforce idempotency on persistence
- capture effect-specific latency and failure metrics
- require compensation metadata on external invocation effects

### 5. Event attachment

An event-attached policy governs visibility, retention, and handling expectations around event emission.

Examples:

- classify an event as audit-visible
- require retention for a minimum period
- define security or integration visibility rules

### 6. Lifecycle attachment

A lifecycle-attached policy governs the progression model over time.

Examples:

- constrain stale transitions
- enforce transition audit
- require observability of all terminal moves

### 7. Transition attachment

A transition-attached policy governs a specific lifecycle movement.

Examples:

- log and audit all moves into terminal failure states
- apply timeout rules to a waiting phase
- require approval evidence for a specific transition

---

## Policy Families

To make policy semantics clearer, DCL should treat policy as a single primitive with multiple semantic families.

### 1. Control Policies

These modify execution behavior around a boundary.

Examples:

- retry
- timeout
- idempotency
- concurrency limits
- rate limits
- ordering guarantees

### 2. Assurance Policies

These constrain acceptable behavior and define non-functional guarantees.

Examples:

- authorization
- consistency
- security classification
- retention
- data handling constraints
- reliability guarantees

### 3. Visibility Policies

These define what must be observable and how execution evidence must be surfaced.

Examples:

- tracing
- audit
- metrics
- structured logging
- correlation and causation visibility

### 4. Performance / SLO Policies

These define expected service quality characteristics.

Examples:

- latency budgets
- throughput expectations
- error-rate budgets
- availability expectations
- percentile targets

These may be represented as a specialized family or as part of assurance/control depending on later policy taxonomy work.

---

## Observability as a Policy-Derived Capability

One of the strongest consequences of policy as architectural envelope is that observability becomes compiler-derived rather than developer-scattered.

Instead of ad hoc log statements, the compiler can derive structured observability constructs from policy and capability semantics.

### Capability-level observability envelope

A capability-level visibility or performance policy may derive:

- capability started
- capability completed
- selected outcome
- total duration
- retry count
- policy decisions
- effect summary
- lifecycle movement
- actor/context correlation
- tenant/correlation identifiers

### Effect-level observability envelope

An effect-level policy may derive:

- effect started
- effect resolved
- effect failed
- effect retries
- effect duration
- target metadata
- compensation markers

### Benefit

This makes capability execution traceable in terms the language understands:

- which intent ran
- which rule failed
- which policy denied
- which effect retried
- which outcome was selected
- which lifecycle transition occurred

This is stronger than ordinary handwritten logging because it is:

- structured
- derived from semantics
- consistent across capabilities
- portable across supported runtimes

---

## Policy Envelope vs Sidecar

The idea may feel similar to a sidecar or wrapper, but those terms are not precise enough for the language.

DCL policy is not merely a deployment-side companion.
It is part of the capability's declared execution meaning.

Preferred terms:

- architectural envelope
- policy envelope
- execution envelope

These better express that the behavior is compiler-derived from semantic source rather than bolted on later.

---

## Compiler Responsibilities

When policy is treated as architectural envelope, the compiler must do more than validate attachment points.

It must:

### 1. Validate attachment legality
- ensure a policy kind may attach to the declared semantic boundary
- reject unsupported attachments

### 2. Validate parameters
- ensure policy parameters are well-formed
- ensure required parameters exist
- detect invalid combinations

### 3. Derive execution envelope
- map the policy to the correct execution boundary
- derive behavioral implications
- classify whether the envelope is portable, target-valid, or unsupported

### 4. Derive observability obligations
- determine what logs, traces, metrics, and audit signals must be emitted
- derive required correlation fields
- derive policy-specific visibility requirements

### 5. Derive verification obligations
- determine what scenarios must be tested
- derive policy conformance cases
- derive failure and exhaustion scenarios where relevant

### 6. Detect semantic conflicts
- conflicting retries
- contradictory timeout rules
- incompatible visibility levels
- policies whose combined guarantees cannot be honored

### 7. Surface degraded guarantees
- warn when a runtime target cannot fully realize the declared policy
- classify portability/fidelity explicitly

---

## Runtime Responsibilities

The runtime must faithfully realize the policy envelope derived by the compiler.

This includes:

- enforcing declared policies at the right boundary
- surfacing policy decisions observably
- preserving causation and correlation metadata
- preserving explicit outcome behavior
- preserving effect and lifecycle semantics
- surfacing retries, timeouts, denials, and degradations

The runtime must not silently weaken or reinterpret the declared policy model.

---

## Generated Code Implications

Policy as architectural envelope suggests a two-layer target shape for generated code.

### 1. Capability Core

The capability core contains the business behavior:

- input binding
- invariant evaluation
- explicit outcome selection
- effect invocation
- lifecycle and event hooks

### 2. Policy Envelope

The policy envelope contains the operational architecture:

- tracing
- structured logging
- retries
- timeouts
- metrics
- audit capture
- authorization guards
- SLO instrumentation

This separation keeps business logic readable while keeping architectural behavior explicit and consistent.

---

## Verification Implications

Policy should not only affect runtime behavior.
It should also affect generated verification.

A declared policy creates verification obligations.

### Examples

#### Retry policy
Generated verification may include:

- retriable failure branch retries
- retry exhaustion behavior
- non-retriable branches do not retry
- final selected outcome after retry exhaustion

#### Timeout policy
Generated verification may include:

- capability timeout behavior
- timeout-caused outcome or termination classification
- visibility of timeout events and metrics

#### Authorization policy
Generated verification may include:

- allowed actor path
- denied actor path
- traceability of policy denial

#### Performance policy
Generated verification may include:

- latency budget measurement
- threshold violation visibility
- environment-specific SLO conformance checks

#### Visibility policy
Generated verification may include:

- required structured fields emitted
- trace/correlation presence
- audit event production when declared

This gives policy a dual role:

- execution control
- verification contract

---

## Diagram Implications

Capability diagrams should include policy envelopes explicitly.

A generated diagram for a capability should not show only input, rules, effects, and outcomes.
It should also show:

- capability-level policy envelope
- effect-level policy envelopes
- policy-caused branches where explicit
- observability requirements where materially useful
- performance/SLO constraints where declared

This makes the architecture visible as part of the capability view rather than as invisible platform behavior.

---

## Vertical Slice Reframed

In a DCL-influenced architecture, a vertical slice is not just a handler.

It is the coming together of:

- capability meaning
- invariants
- outcomes
- effects
- lifecycle
- policy envelope
- external ports
- generated observability
- generated verification

A handler is only one projection of the slice.
The capability is the true architectural unit.

---

## Performance Considerations

Policy-derived observability and control behavior introduces runtime cost.
DCL should acknowledge this explicitly.

The model should support later controls such as:

- observability detail levels
- selective sampling
- target-specific optimizations
- environment-based visibility policies
- performance-cost diagnostics

The solution is not to abandon policy-derived architecture.
It is to make the cost model explicit and analyzable.

---

## Non-Goals for v0.5

This document does not yet define:

- full policy taxonomy
- final policy syntax
- full precedence model
- environment/profile-based policy activation
- detailed observability schema
- formal SLO language
- complete verification projection model
- concrete code generation templates

Those should follow as later companion documents.

---

## Open Questions

1. Should visibility be a general policy family or a distinct first-class sibling concept?
2. How should conflicting capability-level and effect-level policies be resolved?
3. How should performance/SLO policies differ from ordinary control policies?
4. Which policy guarantees must be portable across all runtime targets?
5. How should policy-generated observability be tuned for cost-sensitive environments?
6. How should policy-derived verification split between semantic tests, runtime conformance tests, and deployed end-to-end policy tests?

---

## Summary

**Policy is the declarative architectural envelope around semantic behavior.**

It is how DCL makes operational architecture explicit in source, compiler-visible in analysis, consistent in generated code, visible in diagrams, and enforceable through verification.

This turns retries, timeouts, authorization, tracing, logging, metrics, audit, and performance expectations from scattered implementation details into first-class language meaning.

---

Version: v0.1
