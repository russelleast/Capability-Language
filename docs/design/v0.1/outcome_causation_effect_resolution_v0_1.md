# Declarative Capability Language — Outcome Causation & Effect Resolution Semantics v0.1

## Overview

This document defines how **outcomes are selected** within a capability and how **effects contribute to that selection**.

It introduces **causation as a first-class semantic relationship** between existing primitives, without introducing new primitives or premature terminology.

This is a **pre-syntax, semantics-first definition**.

---

## Purpose

The language currently defines:

- capabilities
- intents
- outcomes
- invariants
- effects
- policies
- lifecycle
- events

However, it does not yet define:

**How an outcome becomes selected**

This document resolves that gap.

---

## Core Principle

**An outcome must be selected because of explicitly declared causes.**

There is no implicit or default outcome selection.

If a capability produces an outcome, the compiler must be able to trace:
- what caused it
- under what condition
- from which primitive

---

## Causation Model

### Outcome Causation

An outcome may be **caused by one or more of the following sources**:

- invariant evaluation
- policy decision
- effect resolution
- explicit capability decision

These are relationships across existing primitives.

---

### 1. Invariant → Outcome

An invariant may declare that failure results in a specific outcome.

---

### 2. Policy → Outcome

A policy may influence outcome selection when constraints are violated or access is denied.

Policies must not silently change meaning but may explicitly cause outcomes.

---

### 3. Effect → Outcome (Effect Resolution)

An effect may resolve in multiple declared ways.

Each resolution may:
- cause an outcome
- emit events
- influence lifecycle
- be governed by policy

---

### 4. Capability Decision → Outcome

A capability may explicitly declare a branch that results in an outcome.

---

## Effect Resolution Model

### Definition

An effect may declare one or more **resolution branches**.

Each branch represents a semantically meaningful completion or non-completion of the effect.

---

### Resolution Characteristics

Each resolution branch may:

- cause outcomes
- emit events
- influence lifecycle
- be retried (via policy)
- require compensation
- be observable

---

### Compiler Expectations

The compiler must:

- detect multiple meaningful resolutions
- ensure all relevant branches are handled
- detect unhandled branches
- ensure mappings are unambiguous

---

## Outcome Selection Rules

### Rule 1 — Explicit Causation
Every reachable outcome must have at least one declared cause.

### Rule 2 — No Implicit Defaults
No assumed fallback outcomes.

### Rule 3 — Distinguishability
Outcomes must not overlap without declared precedence.

### Rule 4 — Effect Resolution Coverage
All meaningful effect resolutions must be handled.

### Rule 5 — Policy Visibility
Policy influence must be explicit.

### Rule 6 — Lifecycle Binding
Lifecycle triggers must be reachable and causally connected.

---

## Compiler Obligations

The compiler must:

- validate outcome causation
- detect unreachable outcomes
- detect ambiguous mappings
- detect unhandled effect resolutions
- validate lifecycle triggers
- classify causation paths

---

## Runtime Obligations

The runtime must:

- surface selected outcomes
- execute effects per policy
- surface effect resolution
- emit events
- enforce lifecycle progression

---

## IR Implications

### OutcomeCause (derived)
- outcome reference
- source
- condition
- precedence

### EffectResolution (declared/normalized)
- effect reference
- resolution identifier
- linked outcomes/events/lifecycle

### Causation Analysis (derived)
- reachable outcomes
- ambiguous mappings
- unhandled resolutions
- policy-influenced paths

---

## Non-Goals (v0.1)

- syntax
- global failure taxonomy
- execution engine
- retry algorithms
- compensation mechanics

---

## Design Constraints

- no new primitives
- no hidden behavior
- no reliance on naming conventions
- all causation must be derivable from source

---

## Summary

**Outcomes are selected through explicit causation relationships across invariants, policies, effects, and capability decisions.**

---

Version: v0.1
