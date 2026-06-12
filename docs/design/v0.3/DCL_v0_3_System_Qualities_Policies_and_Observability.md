# Declarative Capability Language
# System Qualities, Policies and Observability
## Decision Record and Specification v0.3

Status: Accepted Direction for v0.3

This document defines the scope and implementation direction for DCL v0.3.

## Purpose

This document serves as:

- Architectural Decision Record
- Language Specification
- Compiler Design Input
- Codex Planning Context
- Feature Acceptance Boundary

## v0.3 Goals

1. System Qualities as Policy Envelopes
2. Declarative Observability

The objective is to make quality attributes and operational visibility first-class language concepts.

## Design Principles

### Capability Defines Meaning

Capabilities define:
- responsibility
- intent
- outcomes
- effects
- lifecycle progression

Policies must not alter business meaning.

### Policy Defines Quality Expectations

Policies define:
- guarantees
- constraints
- objectives
- operational behaviour

### Observability Defines Evidence

Observability defines:
- what should be measured
- what should be traced
- what should be counted
- what evidence should exist

## System Quality Families

### Reliability
- retry
- compensation
- idempotency
- recovery
- ordering guarantees

### Availability
- uptime objectives
- degradation strategies
- dependency tolerance
- fallback behaviour

### Scalability
- concurrency limits
- queueing
- load distribution
- burst handling
- backpressure

### Performance
- latency objectives
- throughput objectives
- execution budgets

### Security
- authorization
- authentication
- encryption
- classification

### Compliance and Governance
- audit requirements
- approvals
- retention rules

### Data Protection
- sensitive data handling
- masking
- retention periods
- deletion requirements

## Policy Semantics

Policies remain a first-class primitive.

Policies may attach to:
- capability
- outcome
- effect
- event
- lifecycle

For v0.3, the compiler implements the following policy syntax:

```dcl
policy SafeRetry {
    family reliability
}
```

The compiler validates policy families only. Policy concern vocabulary such as
retry, idempotency, audit, retention, encryption, PCI, SOC, FCA, and GDPR
remains part of the language direction, but concern parsing, concern-specific
validation, and concern-specific semantics are deferred to v0.4. The AST and IR
reserve a concern field for that fast-follow work.

For v0.3, policy attachments are capability-local:

```dcl
policies {
    SafeRetry governs capability
    SafeRetry governs effect SendVerification
    SafeRetry governs outcome Accepted
    SafeRetry governs event CustomerRegistered
    SafeRetry governs lifecycle
}
```

The v0.3 compiler supports attachment to capability, effect, outcome, event,
and lifecycle only.

## Quality Objectives

Policies may declare measurable objectives:
- availability targets
- latency targets
- throughput targets
- success-rate targets

## Observability Model

Observability is a dedicated language construct.

Observability is semantic rather than infrastructure-centric.

Observable targets:

- capability
- outcome
- effect
- event
- lifecycle

For v0.3, observability declarations are capability-local only.

Observation types:

- count
- duration
- violations
- failures
- transitions

Example:

```dcl
capability RegisterCustomer {
  observe {

    capability duration

    outcome Accepted
        count as registrations_completed

    effect SendVerification
        count failures as verification_failures
  }
}
```

## Compiler Responsibilities

The compiler must:

- validate quality families
- validate policy attachments
- validate observability declarations
- resolve observed symbols
- derive observability obligations
- derive verification obligations

## New Analysis Passes

### Policy Conflict Analysis
Detect incompatible policies and objectives.

### Quality Coverage Analysis
Detect missing reliability, security, protection, and observability coverage.

### Objective Feasibility Analysis
Detect unrealistic or contradictory objectives.

### Scalability Analysis
Detect overload and growth risks.

### Observability Coverage Analysis
Detect insufficient visibility.

## IR Changes

PolicyIR:

```text
PolicyIR
- family
- concern
- attachment_points
```

The `concern` field is reserved for v0.4 and remains empty in v0.3.

ObservationIR:

```text
ObservationIR
- target_kind
- target_reference
- observation_type
- metric_name
```

## Runtime Responsibilities

The runtime must:

- enforce policy envelopes
- emit declared observations
- preserve semantic attribution
- surface policy violations

## Non-Goals

v0.3 does not define:

- policy inheritance
- contexts
- visibility semantics
- dependency semantics
- deployment projections
- environment profiles

## Success Criteria

v0.3 is complete when:

- quality families compile
- policies are classified by family
- observability declarations compile
- observations resolve semantic symbols
- IR supports policies and observations
- analysis passes validate quality concerns

## Decision

DCL v0.3 introduces:

1. System Qualities as Policy Envelopes
2. Declarative Observability

Policies express quality expectations.

Observability expresses evidence requirements.

Version: v0.3
Status: Accepted
