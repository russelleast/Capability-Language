# DCL v0.8 — Lifecycle Completion Semantics

## Status

Proposed

## Purpose

DCL v0.8 completes the current lifecycle model.

Previous versions established lifecycle ownership, lifecycle progression, cross-capability transition sources, and supervising lifecycles.

v0.8 focuses on making lifecycle steps semantically complete while keeping the language readable and learnable.

The central question for v0.8 is:

> What does it mean to be in a lifecycle step?

This version introduces:

- step kinds
- waiting states
- deadlines
- recovery
- contributors

It does not introduce a new lifecycle coordination phase.

---

# Design Principles

## 1. Complete the Lifecycle Model

v0.8 should close the main lifecycle semantics gap before moving into tooling, documentation, wiki pages, language review, and usability testing.

## 2. Keep Syntax Light

Humans are creatures of habit.

DCL should avoid heavy multi-step syntax where possible.

Avoid forms that require users to remember complex nesting patterns similar to:

```text
if ... then ... else
case ... when ... then
```

DCL syntax should be:

- readable
- predictable
- low ceremony
- easy to scan
- hard to misuse

## 3. Semantics Before Syntax

Syntax must express lifecycle meaning clearly.

It must not introduce workflow-engine terminology or implementation assumptions.

## 4. Business Semantics over Runtime Semantics

Lifecycle constructs describe business progression.

They do not describe:

- workflow engines
- queues
- schedulers
- distributed transaction protocols
- threads
- infrastructure orchestration

## 5. Explicit Causation

Lifecycle movement must remain causally traceable.

A transition may be caused by:

- an outcome
- an event
- a deadline
- a recovery result

No lifecycle movement may be implicit.

---

# Core Model

A lifecycle has:

```text
owner
contributors
steps
transitions
deadlines
recovery
```

## Owner

The owner is the capability that owns lifecycle state.

A lifecycle instance has exactly one owner.

## Contributors

A contributor is a capability that may influence lifecycle progression by producing declared outcomes or events.

Contributors do not own lifecycle state.

Contributors do not directly mutate lifecycle position.

They contribute signals that the lifecycle owner may use as transition causes.

Example:

```dcl
lifecycle OrderFulfilment {

  contributors {
    CheckInventory
    CapturePayment
    ShipOrder
    RefundPayment
  }

  begin Pending

  step Pending
  step AwaitingPayment
  step Paid
  step Shipped

  end Completed
  end Failed
}
```

---

# Step Kinds

A lifecycle step may declare a semantic kind.

Suggested kinds:

```text
active
waiting
decision
recovery
terminal
```

## Active

Work is expected to happen while the lifecycle is in this step.

```dcl
step Processing {
  kind active
}
```

## Waiting

The lifecycle is waiting for an external signal, actor action, event, outcome, or deadline.

```dcl
step AwaitingPayment {
  kind waiting
}
```

## Decision

The lifecycle is positioned at a business decision point.

```dcl
step AwaitingApproval {
  kind decision
}
```

## Recovery

The lifecycle is attempting to restore business correctness.

```dcl
step RecoveringPayment {
  kind recovery
}
```

## Terminal

The lifecycle has ended.

Terminal steps may also be declared using `end`.

```dcl
end Completed
end Failed
```

---

# Waiting States

A waiting step declares what it waits for.

Example:

```dcl
step AwaitingPayment {
  kind waiting

  waits for event PaymentReceived from CapturePayment
}
```

A waiting step may wait for more than one signal:

```dcl
step AwaitingCustomerAction {
  kind waiting

  waits for event CustomerVerified from VerifyCustomer
  waits for outcome VerificationCancelled from CancelVerification
}
```

## Compiler Obligations

The compiler must reject a waiting step that:

- has no declared wait condition
- has no possible exit transition
- waits for an undefined outcome or event
- waits for a signal from a non-contributor
- cannot be reached

---

# Deadlines

A step may declare a deadline.

A deadline defines how long a lifecycle instance may remain in that step before a declared consequence occurs.

Example:

```dcl
step AwaitingPayment {
  kind waiting

  waits for event PaymentReceived from CapturePayment

  deadline 15 minutes causing outcome PaymentExpired
}
```

The consequence must be explicit.

A deadline must not silently move lifecycle state.

The deadline consequence can then be used by a transition:

```dcl
move AwaitingPayment to Expired
  on outcome PaymentExpired
```

## Compiler Obligations

The compiler must validate:

- deadline duration
- declared consequence
- outcome/event existence
- transition reachability
- conflicting deadlines on the same step

---

# Recovery

DCL uses the term **recovery** rather than **compensation**.

Recovery means restoring business correctness when previous progress can no longer stand.

Recovery does not imply rollback.

Recovery may mean:

- refunding a payment
- releasing reserved inventory
- cancelling a booking
- deactivating an account
- reversing an allocation
- notifying a party of failure

Example:

```dcl
step PaymentCaptured {
  recovery RefundPayment
}
```

A recovery target may be a capability or effect, depending on the authored model and compiler support.

Recovery outcomes remain ordinary outcomes.

Example outcomes:

```dcl
outcomes {
  Recovered
  RecoveryFailed
  PartiallyRecovered
}
```

Recovery introduces no new outcome primitive.

## Compiler Obligations

The compiler must validate:

- recovery target exists
- recovery target is reachable
- recovery target is declared as a contributor where cross-capability recovery is used
- recovery result outcomes are declared
- recovery paths do not create invalid lifecycle loops

---

# Contributors

Contributors replace the earlier idea of a participation model.

The term is shorter, clearer, and more directly tied to lifecycle causation.

A contributor is a capability whose outcomes or events may be used by lifecycle transitions, waiting conditions, deadlines, or recovery paths.

Example:

```dcl
contributors {
  CheckInventory
  CapturePayment
  ShipOrder
  RefundPayment
}
```

## Rules

A contributor may:

- produce outcomes that trigger lifecycle transitions
- emit events that trigger lifecycle transitions
- provide recovery behavior

A contributor must not:

- directly mutate lifecycle state
- introduce undeclared transitions
- become an implicit lifecycle owner

## Compiler Obligations

The compiler must detect:

- transition sources from undeclared contributors
- waiting signals from undeclared contributors
- recovery targets from undeclared contributors
- declared contributors that are unused
- contributor references that do not exist

---

# Example

```dcl
capability OrderFulfilment {

  supervises lifecycle OrderLifecycle {

    identity OrderId

    contributors {
      CheckInventory
      CapturePayment
      ShipOrder
      RefundPayment
    }

    begin Pending

    step Pending {
      kind active
    }

    step AwaitingPayment {
      kind waiting

      waits for event PaymentReceived from CapturePayment

      deadline 15 minutes causing outcome PaymentExpired
    }

    step PaymentCaptured {
      kind active

      recovery RefundPayment
    }

    step RecoveringPayment {
      kind recovery
    }

    end Completed
    end Expired
    end Failed

    move Pending to AwaitingPayment
      on outcome InventoryReserved from CheckInventory

    move AwaitingPayment to PaymentCaptured
      on event PaymentReceived from CapturePayment

    move AwaitingPayment to Expired
      on outcome PaymentExpired

    move PaymentCaptured to Completed
      on outcome OrderShipped from ShipOrder

    move PaymentCaptured to RecoveringPayment
      on outcome ShippingFailed from ShipOrder

    move RecoveringPayment to Failed
      on outcome RecoveryFailed from RefundPayment
  }
}
```

---

# IR Changes

LifecycleIR should include:

```text
name
owner_capability
identity_binding
contributors
steps
transitions
policies
```

LifecycleStepIR should include:

```text
name
kind
waiting_triggers
deadlines
recovery_actions
is_terminal
```

TransitionIR should include:

```text
source_step
target_step
source_kind
source_capability
source_symbol
correlation_binding
```

DeadlineIR should include:

```text
step
duration
consequence_kind
consequence_symbol
```

RecoveryIR should include:

```text
declaring_step
target
target_kind
result_outcomes
```

ContributorIR should include:

```text
capability
used_by_transitions
used_by_waiting_steps
used_by_recovery
```

---

# Analysis Passes

v0.8 adds or extends the following compiler analysis passes.

## Step Semantics Analysis

Detect:

- invalid step kind usage
- unreachable steps
- terminal steps with outgoing transitions unless explicitly allowed
- steps with unclear semantic role

## Waiting Analysis

Detect:

- waiting steps without wait conditions
- waiting steps without exit paths
- unresolved wait signals
- wait signals from non-contributors

## Deadline Analysis

Detect:

- invalid deadline durations
- missing deadline consequences
- unreachable deadline consequences
- conflicting deadlines

## Recovery Analysis

Detect:

- missing recovery targets
- invalid recovery targets
- recovery paths with no declared outcome
- recovery loops without termination

## Contributor Analysis

Detect:

- undeclared contributors
- unused contributors
- transition sources from non-contributors
- recovery targets from non-contributors

---

# Syntax Usability Rule

Before accepting new lifecycle syntax, ask:

```text
Can a user remember this after seeing it once?
Can the compiler explain what it means?
Can the same idea be expressed with fewer nested constructs?
Does the syntax describe business meaning rather than runtime mechanics?
```

If the answer is no, the syntax is not ready.

---

# Non-Goals

v0.8 does not define:

- lifecycle choreography
- lifecycle reuse or inheritance
- workflow engine behavior
- scheduler implementation
- distributed transaction protocols
- saga implementation details
- infrastructure orchestration
- deployment projections

---

# After v0.8

After v0.8, the next phase should focus on language usability and adoption foundations:

- wiki structure
- language review
- syntax review
- examples review
- readability testing
- playground direction
- documentation generation
- guidance for humans and AI coding agents

The goal is to check whether DCL is understandable, teachable, and usable before adding more language surface area.

---

# Summary

DCL v0.8 completes lifecycle semantics by introducing:

- step kinds
- waiting states
- deadlines
- recovery
- contributors

The version deliberately avoids expanding into a new roadmap area.

The priority is to complete the lifecycle model while keeping the language small, memorable, and semantically clear.
