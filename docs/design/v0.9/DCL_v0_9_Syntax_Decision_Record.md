# DCL v0.9 Syntax Decision Record

## Status

Accepted for v0.9 implementation.

Implementation amendments:

- active is the default lifecycle step role and should not be promoted as authored syntax
- `requires decision from` resolves actor symbols and capability actor roles; ambiguous role/symbol names produce diagnostics
- event ownership failures are migration-friendly warnings in v0.9
- policy family blocks are a deferred design direction and recommendation-only in v0.9
- effect-level event ownership remains a future design question

## Context

The v0.8 syntax pressure test pack exercised local lifecycles, supervising lifecycles, contributors, waits, deadlines, recovery, policies, events, effects, actor decisions, and cross-context visibility.

The compiler results were largely positive. The pressure tests exposed several places where the language is semantically sound but the authored syntax creates unnecessary ceremony or weak human readability.

This decision record captures the agreed v0.9 syntax direction. It is intentionally focused on language shape and semantic clarity. It does not define the full parser implementation plan.

## Design Principles

The v0.9 changes follow the existing DCL principles:

- capabilities remain the core architectural unit
- syntax must express semantic meaning, not compiler metadata
- local ownership should not require redundant ceremony
- event, lifecycle, and decision causation must be compiler-verifiable
- source should be readable by humans and precise enough for AI-assisted generation
- naming should reduce ambiguity between outcomes, states, effects, and commands

---

# Decisions

## 1. Local lifecycle owner is implicit

### Decision

A lifecycle declared inside a capability is owned by that capability. The owning capability must not need to be redeclared as a contributor.

### Before

```dcl
capability CollectPayment {
  lifecycle {
    contributors {
      CollectPayment
    }

    step AwaitingPayment {
      kind waiting
      waits for event PaymentReceived from CollectPayment
    }
  }
}
```

### After

```dcl
capability CollectPayment {
  lifecycle {
    step AwaitingPayment waits for event PaymentReceived
  }
}
```

### Semantics

For a local lifecycle, omitted `from <Capability>` means the lifecycle owner.

The compiler normalizes this to an explicit source in IR:

```text
wait source = CollectPayment
```

### Compiler behavior

The compiler should:

- infer the owning capability as the source for local lifecycle waits when `from` is omitted
- continue to require explicit `from <Capability>` for supervising lifecycle waits and transitions
- reject omitted sources where there is no clear lifecycle owner

---

## 2. Capabilities can declare emitted events

### Decision

Capabilities may declare which events they emit.

This allows lifecycle waits and transitions that reference `event X from CapabilityY` to be verified by the compiler.

### Problem

This syntax is readable:

```dcl
step AwaitingPayment waits for event PaymentReceived from CollectPayment
```

But without an emission declaration, the compiler can only prove that:

- `PaymentReceived` exists
- `CollectPayment` exists

It cannot prove that `CollectPayment` is a valid emitter of `PaymentReceived`.

### New syntax

```dcl
capability CollectPayment {
  events {
    emits PaymentReceived
  }
}
```

### Example

```dcl
event PaymentReceived is {
  paymentId: Uuid required
  orderId: Uuid required
}

capability CollectPayment {
  events {
    emits PaymentReceived
  }

  lifecycle {
    step AwaitingPayment waits for event PaymentReceived
  }
}
```

### Semantics

`events { emits X }` declares that the capability is an emission source for event `X`.

This does not specify transport, broker, topic, delivery mechanism, or subscription model.

### Compiler behavior

The compiler should:

- validate that emitted events exist
- validate that `event X from CapabilityY` references a capability that declares `emits X`
- remove or reduce `DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED` when ownership is declared
- keep warning when event source ownership cannot be proven

### Future extension

Effect-to-event causation may be introduced later:

```dcl
effect CapturePayment emits PaymentReceived
```

That should be treated as a more precise form, not a replacement for capability-level event ownership.

---

## 3. Replace lifecycle `kind` with semantic phrases

### Decision

Lifecycle steps should be written using semantic phrases rather than `kind` metadata.

### Problem

The current form reads like compiler classification rather than authored business language:

```dcl
step Submitted {
  kind active
}

step AwaitingPayment {
  kind waiting
}

step AwaitingApproval {
  kind decision
}
```

### Preferred forms

```dcl
step AwaitingPayment waits for event PaymentReceived
```

```dcl
step AwaitingApproval requires decision from Manager
```

### Semantics

Lifecycle step roles are still semantic classifications, but the authored syntax should describe what the step means:

- active step: the default role when no waiting, decision, recovery, or terminal marker is present
- waiting step: the lifecycle is blocked until a declared signal is observed
- decision step: the lifecycle requires a decision from a declared actor

### Compiler behavior

The compiler should normalize these authored forms into lifecycle step classifications in IR.

Legacy `kind` remains valid for compatibility, but documentation should prefer
meaning-bearing markers over `kind active`.

---

## 4. Add `always then` for unconditional outcome causation

### Decision

Use `always then <Outcome>` when a capability always produces a given outcome and no conditional branch is needed.

### Problem

This form is valid but reads badly:

```dcl
when {
  otherwise then VerificationStarted
}
```

`otherwise` is meaningful when there are previous branches. Alone, it reads like “when otherwise”.

### New form

```dcl
when {
  always then VerificationStarted
}
```

### Semantics

`always then X` means the outcome is caused unconditionally by the capability decision path.

It is not a fallback. It is an unconditional causation declaration.

### Compiler behavior

The compiler should:

- allow one `always then` branch in a `when` block
- reject `always then` when combined with other branches unless a later design defines precedence
- continue to require `otherwise then` to appear only after conditional branches

---

## 5. Add built-in structural value types

### Decision

DCL v0.9 should add the following built-in value types:

- `Uuid`
- `Email`
- `Money`

### Example

```dcl
shape CustomerAccountRef {
  customerId: Uuid required
  email: Email required
  outstandingBalance: Money
}
```

### Semantics

These are structural value types, not capabilities.

Suggested meanings:

- `Uuid`: universally unique identifier value
- `Email`: email address value with basic structural validation expectations
- `Money`: monetary amount value, with future room for currency semantics

### Compiler behavior

The compiler should:

- recognize these as built-in value types
- allow them in shapes, event payloads, and outcome payloads
- avoid treating them as user-defined shapes unless explicitly shadowing is later supported

### Future extension

Generic identity types may be considered later:

```dcl
customerId: Id<Customer> required
```

This is not part of the v0.9 decision.

---

## 6. Add explicit decision actor syntax

### Decision

Decision lifecycle steps should identify the actor responsible for the decision.

### New syntax

```dcl
step AwaitingApproval requires decision from Manager
```

### Semantics

The step is a decision point and the declared actor is the expected decision authority.

This does not imply UI workflow, task assignment, approval screen, or human orchestration technology. It declares the business authority required to progress the lifecycle.

### Compiler behavior

The compiler should:

- validate that the actor exists
- validate capability actor roles as decision providers
- report ambiguity when a name matches both an actor role and an actor symbol
- classify the step as a decision step
- preserve the decision actor in IR
- allow transitions out of the step to remain explicitly caused by outcomes or events

### Example

```dcl
actor Manager {
  kind human
}

capability ApproveRefund {
  lifecycle {
    step AwaitingApproval requires decision from Manager

    move AwaitingApproval to Approved
      on outcome RefundApproved

    move AwaitingApproval to Rejected
      on outcome RefundRejected
  }
}
```

---

## 7. Use noun-based effect kinds

### Decision

Effect kind shorthand should use noun-based classifications.

### Accepted forms

```dcl
effect PublishInvoice is notification
```

```dcl
effect PersistInvoice is persistence
```

```dcl
effect ChargeCard is invocation
```

### Rationale

The previous forms read awkwardly:

```dcl
effect PublishInvoice is notify
```

```dcl
effect PersistInvoice is persist
```

`notification`, `persistence`, and `invocation` describe the kind of effect rather than sounding like imperative commands.

### Compiler behavior

The compiler should normalize these forms to effect kind values.

Recommended normalized values:

```text
notification
persistence
invocation
```

### Compatibility

The existing block form remains valid:

```dcl
effect PublishInvoice {
  kind notification
}
```

---

## 8. Policy declarations may contain family blocks

### Deferred design direction

A future policy authoring revision should review whether a policy may contain
more than one explicit family block when those concerns form one coherent
architectural envelope.

### Example

```dcl
policy RegistrationPolicy {
  reliability {
    retry 3 times
    backoff exponential
  }

  observability {
    trace
    metric latency p95 under 500ms
  }

  security {
    requires actor Customer
  }
}
```

### Semantics

A policy remains a single architectural envelope. Family blocks group related concerns inside that envelope.

This avoids forcing authors to create many small policy declarations when the concerns are intentionally applied together.

### v0.9 compiler behavior

The v0.9 compiler should not implement new policy-family-block semantics unless
they already exist. The review should recommend whether this direction improves
readability, reduces single-purpose policy proliferation, and preserves existing
policy semantics.

No new policy families are introduced in v0.9.

## 9. Event ownership and effect ownership

Capability-level event ownership is implemented first:

```dcl
capability CollectPayment {
  events {
    emits PaymentReceived
  }
}
```

Future design should decide whether effect-level ownership such as
`effect CapturePayment emits PaymentReceived` refines, supplements, or supersedes
capability-level ownership. This is not implemented in v0.9.

---

# Guidance Decisions

## Outcome naming guidance

Outcomes should describe business result facts, not commands, lifecycle states, or technical effects.

Prefer:

```dcl
InviteAcceptedForSending
InviteRejected
ErasureIncomplete
```

Avoid:

```dcl
SendInvite
InviteSending
EvidenceRecordingFailed
```

This is guidance first. It may later become an advisory diagnostic.

## Lifecycle step naming guidance

Lifecycle steps should describe positions over time.

Prefer:

```dcl
SendingInvite
AwaitingApproval
PaymentExpired
```

Avoid using the same name for both outcome and lifecycle step unless there is a clear reason.

---

# Non-Decisions

The following are not decided in v0.9:

- transport or broker mapping for events
- effect-to-event causation as a required form
- generic `Id<T>` support
- policy precedence syntax
- inferred contributors for supervising lifecycles
- lifecycle choreography semantics
- runtime execution model

---

# Summary of v0.9 Surface Direction

The v0.9 syntax direction is:

```dcl
capability CollectPayment {
  events {
    emits PaymentReceived
  }

  lifecycle {
    step AwaitingPayment waits for event PaymentReceived
  }
}
```

```dcl
step AwaitingApproval requires decision from Manager
```

```dcl
when {
  always then VerificationStarted
}
```

```dcl
shape PaymentRef {
  paymentId: Uuid required
  payerEmail: Email required
  amount: Money required
}
```

```dcl
effect PublishInvoice is notification
effect PersistInvoice is persistence
effect ChargeCard is invocation
```

These changes reduce ceremony, make event ownership provable, improve lifecycle readability, and keep the language aligned with DCL's core principle: source should clearly declare what the system means, what it causes, and what the compiler can verify.
