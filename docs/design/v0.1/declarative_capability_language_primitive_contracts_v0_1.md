# Declarative Capability Language — Primitive Contracts v0.1

## Overview

This document defines the **primitive contracts** for the declarative capability language.

These contracts are intentionally **thin**. They are not a full language specification.
They exist to make the semantic core precise enough to:

- support early examples
- reduce ambiguity
- guide compiler behavior
- separate language meaning from syntax design

The primitives covered here are:

- capability
- actor
- intent
- outcome
- invariant
- effect
- event
- lifecycle
- policy

---

## Contract Template

Each primitive is defined by:

- **Purpose** — why the primitive exists
- **Semantic role** — what it means in the language
- **Minimum required parts** — what must be declared
- **Optional parts** — what may be declared
- **Legal relationships** — what it may contain, reference, or be referenced by
- **Compiler obligations** — what must be validated statically where possible
- **Runtime obligations** — what must be enforced or surfaced during execution

---

## 1. Capability

### Purpose
The top-level unit of business responsibility.

### Semantic role
A capability defines what a system is responsible for doing in business terms.
It evaluates intent, enforces invariants, applies policy, produces outcomes, and may cause effects or emit events.

### Minimum required parts
- name
- at least one accepted intent
- at least one declared outcome

### Optional parts
- invariants
- effects
- emitted events
- lifecycle
- attached policies
- observability declarations
- documentation metadata

### Legal relationships
A capability:
- accepts one or more intents
- declares one or more outcomes
- may reference actors
- may enforce invariants
- may cause effects
- may emit events
- may participate in or own a lifecycle
- may have policies attached

A capability must not:
- depend on transport concepts such as HTTP request or response
- rely on hidden runtime conventions for required behavior

### Compiler obligations
The compiler must:
- reject a capability with no intent
- reject a capability with no declared outcomes
- verify all referenced primitives exist and are compatible
- detect ambiguous outcome declarations where distinguishability is required
- verify attached policies are valid for the target attachment point

### Runtime obligations
The runtime must:
- evaluate the capability according to declared semantics
- surface the chosen outcome
- apply declared policies
- surface declared effects and events observably

---

## 2. Actor

### Purpose
Represents the initiating or participating party.

### Semantic role
An actor is the source, participant, delegate, or authority context involved in capability execution.

### Minimum required parts
- name
- classification

### Optional parts
- identity shape
- authority model
- tenancy scope
- trust level
- metadata

### Legal relationships
An actor:
- may express intent
- may be referenced by capability, policy, invariant, lifecycle transition, event, or effect
- may participate directly or indirectly

An actor may represent:
- human user
- external system
- internal system
- automated agent
- scheduled agent
- tenant-scoped principal

### Compiler obligations
The compiler must:
- require a declared classification
- validate actor references used by policies and invariants
- reject references to undefined actor classes

### Runtime obligations
The runtime must:
- bind execution to the acting context where required
- preserve actor context for authorization, audit, and observability

---

## 3. Intent

### Purpose
Represents a declared attempt to use a capability.

### Semantic role
Intent is the transport-agnostic expression of desired business action.

### Minimum required parts
- name
- associated capability
- input shape or declared empty input

### Optional parts
- initiating actor constraints
- preconditions
- classification
- documentation metadata

### Legal relationships
An intent:
- must belong to at least one capability
- may reference one or more permitted actor classes
- may be guarded by invariants or policies
- may lead to one or more outcomes

An intent must not:
- imply transport semantics
- imply synchronous completion

### Compiler obligations
The compiler must:
- reject unbound intents
- verify intent input references valid structural definitions
- validate actor constraints if declared

### Runtime obligations
The runtime must:
- capture and preserve intent identity for traceability
- evaluate the intent within its capability context

---

## 4. Outcome

### Purpose
Represents a declared result class of capability evaluation.

### Semantic role
An outcome is a finite, named completion class, including both successful and unsuccessful results.

### Minimum required parts
- name
- associated capability

### Optional parts
- payload shape
- classification
- terminality
- lifecycle effect
- emitted events
- effect triggers
- documentation metadata

### Legal relationships
An outcome:
- must belong to at least one capability
- may be associated with one or more intents
- may carry structured payload
- may trigger lifecycle progression
- may permit or require event emission
- may indicate failure without being an exception

Typical classifications may include:
- success
- failure
- rejection
- partial
- deferred
- expired
- compensated

### Compiler obligations
The compiler must:
- reject undeclared outcomes
- verify outcome payload shape compatibility
- verify transitions or effects triggered by outcomes are valid

### Runtime obligations
The runtime must:
- surface the selected outcome explicitly
- preserve outcome classification for handling, audit, and observability

---

## 5. Invariant

### Purpose
Represents a condition that must hold.

### Semantic role
An invariant declares business correctness constraints over values, context, lifecycle position, or transitions.

### Minimum required parts
- name
- expression target
- assertion

### Optional parts
- severity
- scope
- associated failure outcome
- documentation metadata

### Legal relationships
An invariant may apply to:
- intent input
- actor context
- capability execution
- outcome validity
- lifecycle state
- lifecycle transition
- effect preconditions
- event validity

An invariant must not:
- depend on hidden side effects to be evaluated

### Compiler obligations
The compiler must:
- validate the target of each invariant
- determine whether the invariant is provable statically, enforceable at runtime, or both
- reject invariants whose references are unresolved
- reject invariants that are semantically contradictory when contradiction is detectable

### Runtime obligations
The runtime must:
- enforce non-static invariants at the declared scope
- surface invariant violations through declared outcomes or runtime fault rules

---

## 6. Effect

### Purpose
Represents a declared interaction with the external world.

### Semantic role
An effect captures any externally meaningful action beyond pure evaluation.

### Minimum required parts
- name
- effect kind
- origin

### Optional parts
- payload shape
- target reference
- ordering constraints
- idempotency expectations
- retry policy
- compensation semantics
- observability metadata

### Legal relationships
An effect:
- may be caused by a capability
- may be caused conditionally by an outcome
- may be governed by policy
- may depend on invariants
- may emit or correlate with events

Examples include:
- persist
- invoke
- notify
- schedule
- start process
- record audit action

### Compiler obligations
The compiler must:
- validate effect attachment points
- validate effect-specific policy compatibility
- detect undeclared target references where required

### Runtime obligations
The runtime must:
- execute effects according to declared policy
- surface effect execution status observably
- preserve ordering and reliability semantics where declared

---

## 7. Event

### Purpose
Represents an immutable fact emitted by behavior.

### Semantic role
An event records something that has occurred in declared business terms.

### Minimum required parts
- name
- payload shape or declared empty payload
- emission source

### Optional parts
- correlation metadata
- causation metadata
- ordering constraints
- visibility
- retention metadata
- documentation metadata

### Legal relationships
An event:
- may be emitted by a capability
- may be emitted on specific outcomes
- may be referenced by lifecycle progression
- may be governed by policy
- may be observable, auditable, and integratable

An event must:
- be immutable once emitted

### Compiler obligations
The compiler must:
- validate event payload structure
- validate emission source
- reject mutable event declarations if the language forbids them explicitly

### Runtime obligations
The runtime must:
- emit the event as declared
- preserve immutability
- preserve correlation and causation where declared
- surface the event to observability and integration layers as required

---

## 8. Lifecycle

### Purpose
Represents progression over time.

### Semantic role
A lifecycle defines the valid states or phases of a business progression and the allowed transitions between them.

### Minimum required parts
- name
- at least one declared state or phase
- at least one initial state or phase

### Optional parts
- terminal states
- transition rules
- time constraints
- transition-triggering outcomes
- transition-triggering events
- policies
- documentation metadata

### Legal relationships
A lifecycle:
- may be owned by or attached to a capability
- may be advanced by outcomes
- may be advanced by events
- may be constrained by invariants
- may be governed by policy

A lifecycle must not:
- contain unreachable initial definitions when detectably invalid
- allow undefined transitions

### Compiler obligations
The compiler must:
- validate initial state declaration
- validate referenced states and transitions
- detect impossible or undefined transitions where statically knowable
- validate outcome- and event-triggered transitions

### Runtime obligations
The runtime must:
- preserve current lifecycle position where required
- enforce valid transitions only
- surface transition attempts and results observably

---

## 9. Policy

### Purpose
Represents declared non-functional guarantees and operational constraints.

### Semantic role
A policy defines how execution must behave, not what the business meaning is.

### Minimum required parts
- name
- policy kind
- attachment target

### Optional parts
- parameters
- scope
- precedence
- override rules
- enforcement mode
- documentation metadata

### Legal relationships
A policy may attach to:
- capability
- intent
- outcome
- effect
- event
- lifecycle
- lifecycle transition

Typical policy kinds may include:
- authorization
- timeout
- retry
- idempotency
- consistency
- visibility
- audit
- retention
- security classification

A policy must not:
- change the meaning of business outcomes silently
- rely on undeclared runtime magic

### Compiler obligations
The compiler must:
- validate the policy attachment point
- validate policy parameters
- detect incompatible policy combinations where possible
- reject policies unsupported by the selected runtime target when portability rules require it

### Runtime obligations
The runtime must:
- enforce policies at the declared attachment points
- surface policy decisions and violations observably

---

## Cross-Primitive Rules

The following rules apply across the model:

1. A capability must declare at least one intent and at least one outcome.
2. An intent must belong to a capability.
3. An outcome must belong to a capability.
4. An event must have a declared source.
5. An effect must have a declared origin.
6. A lifecycle must declare an initial state or phase.
7. Policy attachment must be explicit.
8. Invariants must target declared elements only.
9. No primitive may depend on hidden transport or framework conventions for semantic meaning.

---

## Structural Layer (Supporting, Not Defined Fully Here)

The following supporting constructs exist but are not fully specified in this document:

- shape
- relationship
- identity
- value

These belong to the structural layer rather than the semantic core, but semantic primitives may reference them.

---

## Scope of v0.1

This contract set does **not yet define**:

- concrete syntax
- full type system
- formal grammar
- effect algebra
- exhaustive policy taxonomy
- portability matrix across runtime targets
- test specification model

It defines only enough semantic structure to support:

- early language examples
- first compiler experiments
- primitive validation rules
- discussion of syntax options without semantic drift

---

## One-line Summary

**The language defines how actors express intent against capabilities, under invariants and policy, producing explicit outcomes, effects, events, and lifecycle progression.**

---

Generated: 2026-04-11T23:03:29.391569+00:00
