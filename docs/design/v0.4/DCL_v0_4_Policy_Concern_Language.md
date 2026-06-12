# Declarative Capability Language
# Policy Concern Language
## Decision Record and Specification v0.4

Status: Accepted Direction for v0.4

## Overview

DCL v0.4 introduces Policy Concerns.

DCL v0.3 introduced:
- System Quality Families
- Policy Envelopes
- Declarative Observability

DCL v0.4 allows specific quality mechanisms to be expressed within those families.

## Core Principle

A policy family answers:

What quality is being addressed?

A policy concern answers:

How is that quality expressed?

## Design Constraints

Policy concerns must:

- describe capability execution qualities
- be compiler analyzable
- remain runtime portable
- remain capability-centric

Policy concerns must not:

- become Infrastructure as Code
- expose vendor settings
- define deployment topology
- describe platform configuration

## Reliability Concerns

Included:

- retry
- backoff
- timeout
- idempotency
- compensation
- circuit_breaker

Excluded:

- service mesh configuration
- retry libraries
- queue implementation details

## Availability Concerns

Included:

- degradation
- fallback
- dependency_tolerance

Excluded:

- multi-region topology
- load balancers
- cloud failover configuration

## Scalability Concerns

Included:

- concurrency
- rate_limit
- queue
- backpressure

Excluded:

- autoscaling configuration
- replica counts
- sharding implementation

## Performance Concerns

Included:

- latency
- throughput
- budget

Excluded:

- CPU tuning
- memory tuning
- thread pool configuration

## Security Concerns

Included:

- authorization
- authentication
- classification
- encryption

Excluded:

- OAuth configuration
- firewall rules
- certificate management

## Compliance and Governance Concerns

Included:

- audit
- retention
- approval
- evidence

Excluded:

- PCI engines
- SOC2 engines
- FCA engines
- legal interpretation

## Data Protection Concerns

Included:

- sensitivity
- masking
- minimization
- retention
- deletion

Excluded:

- GDPR engines
- privacy policy generation
- legal framework execution

## Example

```dcl
policy SafeRetry {

    family reliability

    retry {
        attempts 3
        backoff exponential
    }

    timeout 30s
}
```

## Compiler Responsibilities

The compiler must:

- validate concern placement
- validate concern structure
- validate concern parameters
- detect conflicting concerns
- derive obligations

The compiler must not:

- infer infrastructure implementations
- generate vendor-specific configuration

## IR Changes

PolicyIR

- family
- concerns
- objectives
- attachment_points
- derived_obligations

ConcernIR

- name
- family
- parameters
- source_location

## Analysis Passes

- concern validation
- concern conflict analysis
- concern completeness analysis

## Non Goals

v0.4 does not define:

- Infrastructure as Code
- cloud deployment models
- Kubernetes projections
- compliance engines
- legal rule engines

## Success Criteria

v0.4 is complete when:

- policy concerns parse
- concern validation exists
- concerns appear in IR
- concern diagnostics exist
- concern analysis passes exist

## Decision

Policy concerns are part of DCL.

Policies remain architectural envelopes around capabilities rather than infrastructure definitions.

Version: v0.4
Status: Accepted
