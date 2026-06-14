# DCL Compiler

## Running and Testing

```bash

go run ./cmd/dcl

go test ./...
go test ./internal/compiler

```

examples: 

```bash
go run ./cmd/dcl check some-file.dcl
go run ./cmd/dcl ir some-file.dcl --format json
```

## DCL v0.9 Syntax and Authoring Improvements

The compiler supports v0.9 syntax refinements while preserving v0.8
semantics. Local lifecycle ownership is implicit, so the owning capability
does not need to be repeated as a contributor, and local waits may omit
`from OwnerCapability`.

```dcl
capability CollectPayment {
  events {
    emits PaymentReceived
  }

  lifecycle {
    begin Pending
    step AwaitingPayment waits for event PaymentReceived
    end Complete
  }
}
```

Lifecycle steps default to the active role when no waiting, decision, recovery,
or terminal marker is present. Prefer intent-bearing authored markers such as
`waits for event PaymentReceived` and `requires decision from approver`.
Legacy `kind` declarations remain valid for compatibility.

Capability-level `events { emits X }` declarations allow event source ownership
to be verified. Missing ownership currently produces migration-friendly warnings,
including `DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED`, rather than changing
lifecycle semantics.

`when { always then Outcome }` declares unconditional outcome causation and must
not be mixed with other `when` branches. Existing `otherwise then Outcome`
remains valid for fallback causation.

Built-in structural value types now include `Uuid`, `Email`, and `Money`.

Effect kinds should use noun forms:

```dcl
effect PublishInvoice is notification
effect PersistInvoice is persistence
effect ChargeCard is invocation
```

Legacy `notify`, `persist`, and `invoke` compile with warnings and normalize to
the noun forms in IR.
