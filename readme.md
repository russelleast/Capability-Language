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

## DCL v0.8 Lifecycle Completion

The compiler supports structured lifecycle steps with `kind`, `waits for`,
`deadline`, `recovery`, and `contributors` declarations. Existing
`begin step` / `end step` syntax remains valid, and v0.8 also accepts
the lighter `begin State` / `end State` form.

For `waits for event X from CapabilityY`, the compiler currently validates
that `CapabilityY` is a contributor and that event `X` exists. Capability-level
event emission ownership is not yet represented in the semantic model, so the
compiler emits `DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED` as an explicit
warning rather than treating global event existence as complete proof.
