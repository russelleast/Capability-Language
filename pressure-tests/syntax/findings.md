# Findings

This file records syntax pressure and modelling concerns observed while authoring and compiling the scenarios. It suggests language-shape improvements only; it does not propose compiler behavior changes for this pack.

## High-Signal Syntax Pressure

### Event waits require contributor ceremony

`waits for event X from CapabilityY` is readable in a supervising lifecycle, but it feels heavy in local lifecycles where `CapabilityY` is the owning capability. The current compiler still requires the source to be listed in `contributors`, so local self-waits need this shape:

```dcl
lifecycle {
  contributors {
    CollectPayment
  }

  step AwaitingPayment {
    kind waiting
    waits for event PaymentReceived from CollectPayment
  }
}
```

Minimal syntax improvement to consider later:

```dcl
waits for event PaymentReceived
```

when the source is the lifecycle owner.

### Event source ownership is not expressible

The compiler warns with `DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED` because event emission ownership is not represented. The syntax says `from CapabilityY`, but capabilities cannot declare emitted events. This makes the source phrase feel stronger than the model can prove.

Minimal syntax improvement to consider later:

```dcl
events {
  emits PaymentReceived
}
```

or an effect-to-event relation such as:

```dcl
effect SendVerificationMessage emits VerificationMessageSent
```

### Policy attachment redundancy is hard to predict

Several scenarios trigger `DCL_SEM_REDUNDANT_POLICY` when the same policy concern is effective at multiple boundaries. The syntax for attachment is clear, but the inheritance/effective-policy model is not visible at the call site:

```dcl
policies {
  RegistrationReliability governs capability
  RegistrationReliability governs effect SendVerificationMessage
  RegistrationReliability governs lifecycle
}
```

Minimal syntax improvement to consider later:

```dcl
RegistrationReliability governs capability including effects lifecycle
```

or an explicit override marker when repetition is intentional.

### Deadline consequences are compact but slightly command-like

`deadline 15 minutes causing outcome PaymentExpired` reads well, but it blurs time, causation, and outcome declaration. It also makes a lifecycle step produce an outcome without a `when` branch, which is semantically useful but visually different from normal outcome causation.

Minimal syntax improvement to consider later:

```dcl
deadline 15 minutes then outcome PaymentExpired
```

or:

```dcl
deadline 15 minutes causes PaymentExpired
```

### `begin`, `step`, and `end` have overlapping forms

The compiler supports `begin State`, `begin step State`, `end State`, and `end step State`. The lighter v0.8 form is nice, but mixed examples can make authors wonder whether `step` is a keyword required by lifecycle position declarations or optional marker text.

Minimal guidance improvement: prefer `begin State` and `end State` in v0.8 docs, with `begin step State` / `end step State` documented as legacy-compatible.

### Recovery target syntax is compact but underspecified to readers

`recovery RefundPayment` is pleasantly short, but readers must infer whether `RefundPayment` is a capability, an effect, or a named recovery procedure. The compiler resolves capability/effect ambiguity, which is useful, but the source is visually under-labelled.

Minimal syntax improvement to consider later:

```dcl
recovery capability RefundPayment
```

while keeping the short form as sugar.

## Semantic Modelling Concerns

### Outcome names can sound like states

Scenario 19 uses `Invited` as both an outcome and a terminal lifecycle step, while `InviteSending` is both an outcome and an active step. The compiler accepts this, but it creates reading ambiguity:

```dcl
outcomes {
  Invited
  InviteSending
}

begin InviteSending
end Invited
```

Concern: outcome names are facts caused by the capability, while lifecycle steps are positions over time. Past-tense names often work for both, which makes the model easy to blur.

Naming guidance: prefer outcomes as business facts such as `InviteAcceptedForSending`, and steps as positions such as `SendingInvite`.

### Outcome names can sound like commands

Scenario 19 also includes `SendInvite`, which sounds like an imperative command rather than a business outcome. It compiles, but it is semantically weak because `when { EmailPresent violated then SendInvite }` reads backwards.

Naming guidance: prefer `InviteRejected` or `InviteCannotBeSent`.

### Outcome names can sound like effects

`VerificationDeferred`, `ShipmentExceptionRaised`, and `EvidenceRecordingFailed` are acceptable, but they border on effect or operational status naming. This is clearest when an effect failure causes an outcome:

```dcl
RecordErasureEvidence unresolved then EvidenceRecordingFailed
```

Concern: the outcome describes failure of a technical action rather than the business-visible result. Sometimes this is useful; sometimes the better outcome is `ErasureIncomplete`.

### Waiting steps need explicit exits

The compiler requires waiting steps to have exits. This is semantically good. Authoring pressure appears when a waiting step waits for a signal, but the transition has to repeat the same signal:

```dcl
waits for outcome PaymentCaptured from CapturePayment

move AwaitingPayment to ReadyToShip
  on outcome PaymentCaptured from CapturePayment
```

Minimal syntax improvement to consider later:

```dcl
waits for outcome PaymentCaptured from CapturePayment then ReadyToShip
```

This would reduce repetition but should preserve explicit transition causation.

### Supervising lifecycle identity is easy to forget

`identity orderId` is required and important, but it is visually small compared with contributors and transitions. In longer lifecycle bodies it can disappear.

Minimal syntax improvement to consider later:

```dcl
supervises lifecycle OrderFulfilment by orderId {
}
```

or a required header form:

```dcl
supervises lifecycle OrderFulfilment identity orderId {
}
```

### Contributors are semantically useful but mechanically separate

Contributors are declared in one block and then used by waits, transitions, and recovery. The separation makes validation clear, but it adds maintenance pressure when a contributor appears only once.

Minimal syntax improvement to consider later: allow contributors to be inferred by an optional lint mode, while keeping explicit contributors as the stable compiled form.

## Intentional Diagnostics

### 17 unused contributor

`17-unused-contributor-warning.dcl` intentionally declares `ArchiveBatch` as a contributor but never uses it. This verifies `DCL_SEM_LIFECYCLE_CONTRIBUTOR_UNUSED` and shows that contributors are not merely documentation.

### 18 ambiguous transition

`18-ambiguous-transition-diagnostic.dcl` intentionally sends the same source step and outcome trigger to two target steps. This verifies `DCL_SEM_AMBIGUOUS_LIFECYCLE_TRANSITION`.

### 20 private cross-context access

`20-private-cross-context-diagnostic.dcl` intentionally references a private shape from a dependent context. This verifies `DCL_SEM_SYMBOL_IS_PRIVATE`.

## Minimal Improvement Shortlist

1. Allow omitted `from OwnerCapability` in local lifecycle waits.
2. Add a capability-level event emission declaration.
3. Provide a less repetitive wait-and-transition form for common waiting steps.
4. Make supervised lifecycle identity more prominent in the header.
5. Add naming guidance that distinguishes outcomes from states, commands, effects, and processes.
6. Clarify policy redundancy and effective-policy inheritance in docs.
