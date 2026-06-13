# Supervising Lifecycles (DCL v0.7)

## Status

Proposed

---

# Context

DCL currently supports lifecycles as a first-class semantic primitive.

A lifecycle represents business progression over time and may be advanced by outcomes and events.

However, current lifecycle semantics are primarily capability-local. Real business systems frequently require progression that spans multiple capabilities while preserving:

- explicit ownership
- explicit causation
- analyzability
- observability
- portability

Examples include:

- order fulfilment
- payment processing
- customer onboarding
- claims processing
- loan origination
- AI-assisted review workflows

Existing workflow technologies often model these scenarios using:

- workflows
- orchestration engines
- state machines
- sagas
- BPMN processes

While useful implementation approaches, these concepts introduce runtime and technology assumptions that are outside DCL's semantic model.

DCL must remain capability-first and semantics-first.

---

# Decision

DCL v0.7 introduces **Supervising Lifecycles**.

A supervising lifecycle is:

> A lifecycle owned by a capability that coordinates business progression across multiple capabilities through explicitly declared outcomes and events.

The lifecycle owner is responsible for the progression of a business instance.

Subordinate capabilities participate by producing outcomes and events.

Subordinate capabilities must not directly mutate lifecycle state.

---

# Core Principles

## 1. Single Ownership

Every lifecycle instance has exactly one owning capability.

```dcl
capability OrderFulfilment {
  supervises lifecycle FulfilmentLifecycle {
  }
}
```

Compiler error:

```text
lifecycle_multiple_owners
```

---

## 2. Explicit Causation

All lifecycle transitions must declare their cause.

Valid causes:

- outcome
- event

Example:

```dcl
move PaymentPending to Picking
  on outcome PaymentAuthorised
  from AuthorisePayment
```

The compiler must be able to trace:

- transition
- source capability
- source outcome/event

No implicit progression is permitted.

---

## 3. No Direct Lifecycle Mutation

Subordinate capabilities may:

- produce outcomes
- emit events
- report progress

They must not:

- move lifecycle state
- mutate lifecycle position
- create undeclared transitions

Example:

```dcl
capability AuthorisePayment {

  outcomes {
    PaymentAuthorised
    PaymentDeclined
  }

}
```

The capability influences progression but does not own it.

---

## 4. Correlated Identity

Every lifecycle instance must be identifiable.

Cross-capability transitions must correlate to a specific lifecycle instance.

Example:

```dcl
lifecycle FulfilmentLifecycle {
  identity orderId
}
```

Compiler must validate that transition sources provide the required correlation.

Compiler error:

```text
uncorrelated_transition_source
```

---

## 5. Business-Level Progression

Lifecycle steps represent business meaning.

Good examples:

```text
Pending
PaymentPending
Picking
Dispatching
Completed
Failed
```

Poor examples:

```text
CallApi
ExecuteHandler
SerializeMessage
```

Technical execution details are implementation concerns.

---

## 6. Policy-Governed Progression

Retries, delays, waiting periods, and time-based behaviour remain policy concerns.

Example:

```dcl
policy PaymentTimeout {
  kind timeout
}

policy PaymentTimeout applies to lifecycle FulfilmentLifecycle
```

Supervising lifecycles define progression.

Policies define execution behaviour around that progression.

---

# Lifecycle Flow Model

A supervising lifecycle creates an explicit business flow.

The purpose is not workflow programming.

The purpose is to answer:

- Where is this business instance now?
- What can happen next?
- Which capability can influence progression?
- Which actor participates?
- Which outcome or event causes movement?
- Which policies govern behaviour?

---

# Step Semantics

A step is a business-relevant lifecycle position.

Example:

```dcl
step PaymentPending
```

A step may later support enriched metadata.

Illustrative example:

```dcl
step PaymentPending {
  actor Customer

  awaits outcome PaymentAuthorised from AuthorisePayment
  awaits outcome PaymentDeclined from AuthorisePayment
}
```

This ADR does not require final syntax for enriched steps.

It establishes the semantic direction.

---

# Transition Semantics

Transitions represent movement between lifecycle steps.

Example:

```dcl
move PaymentPending to Picking
  on outcome PaymentAuthorised
  from AuthorisePayment
```

A transition may later include:

- actor participation
- policy attachment
- time constraints
- observability requirements

---

# Relationship to Workflow Concepts

DCL intentionally does not introduce workflow primitives.

| Concept | DCL Position |
|----------|-------------|
| Workflow | Projection |
| BPMN Process | Projection |
| State Machine | Projection |
| Orchestration | Derived Runtime Model |
| Saga | Derived Runtime Model |
| Activity | Not a Primitive |
| Task | Not a Primitive |

DCL source remains lifecycle-centric.

Workflow diagrams, saga implementations, and orchestration runtimes may be generated from lifecycle semantics.

---

# Compiler Responsibilities

The compiler must:

## Ownership Analysis

Validate:

- single lifecycle owner
- valid lifecycle attachment

---

## Transition Analysis

Validate:

- source capability exists
- source outcome/event exists
- transition is reachable
- transition is unambiguous

---

## Correlation Analysis

Validate:

- lifecycle identity exists
- transition sources provide correlation
- lifecycle instance can be resolved

---

## Soundness Analysis

Detect:

- unreachable states
- dead-end states
- impossible transitions
- orphaned transition sources

---

## Policy Analysis

Validate:

- lifecycle-level policies
- transition-level policies
- policy compatibility

---

# Runtime Responsibilities

The runtime must:

- maintain lifecycle state
- validate transitions
- preserve correlation identity
- enforce policies
- emit observability data
- reject invalid transitions

The runtime must not permit lifecycle mutations that are not declared in source.

---

# IR Changes

## LifecycleIR

```text
LifecycleIR
- owner_capability
- identity_binding
- participating_capabilities
- steps
- transitions
- policies
```

## TransitionIR

```text
TransitionIR
- source_step
- target_step
- source_kind
- source_capability
- source_symbol
- correlation_binding
- policies
```

---

# Generated Artifacts

Supervising lifecycles should enable generation of:

- lifecycle diagrams
- capability interaction diagrams
- state diagrams
- orchestration projections
- saga projections
- observability maps
- verification scenarios

---

# Non-Goals

v0.7 does not define:

- BPMN support
- workflow engine integration
- saga execution semantics
- compensation semantics
- execution engine architecture
- distributed transaction models

These may be introduced later as projections or complementary semantic features.

---

# Consequences

Benefits:

- clearer business progression
- capability-centric orchestration model
- stronger observability
- stronger compiler analysis
- better AI understanding
- improved documentation generation

Trade-offs:

- additional lifecycle complexity
- stronger correlation requirements
- additional compiler analysis passes

---

# Summary

DCL v0.7 introduces Supervising Lifecycles as a capability-owned mechanism for coordinating business progression across multiple capabilities.

The language remains lifecycle-centric rather than workflow-centric.

Workflow engines, orchestration runtimes, state machines, and sagas become projections of lifecycle semantics rather than first-class language constructs.
