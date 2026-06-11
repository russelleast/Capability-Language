# DCL v0.2 Compiler Behavior

## Status

Implementation notes for compiler behavior under canonical v0.2 syntax.

## Compatibility

The v0.2 compiler accepts v0.2 syntax only. It does not provide a v0.1 compatibility mode and does not emit deprecation warnings for removed forms.

## Parsing

The parser recognizes concise declarations, singular and block capability forms, word-based causation, `governs` policy attachments, and streamlined lifecycle steps.

Removed v0.1 syntax is rejected during parsing.

## AST Normalization

Singular and block forms normalize into the same AST collections:

- `intent` and `intents` populate capability intents
- `outcome` and `outcomes` populate outcomes
- `rule` and `rules` populate rules
- `effect` and `effects` populate effect uses
- `policies` populates policy attachments

The parser does not create hidden intent names. A singular intent uses the authored input type as the intent name.

## Semantic Validation

The compiler preserves existing semantic guarantees:

- a capability must declare at least one intent
- a capability must declare at least one outcome
- every outcome must have explicit causation
- `otherwise` may appear only once and must be last
- effect ordering references must resolve inside the capability
- policy attachments must target effects used by the capability
- lifecycle transitions must reference known states and valid triggers

## Outcome Causation

The compiler infers causation source kind from v0.2 decision words:

- `violated` means rule
- `unresolved` means effect
- `denied` means policy
- `otherwise` means capability fallback

The IR stores v0.2 condition words in outcome-cause analysis and causation relations.

## IR

No IR schema change is required for v0.2.

Authored rules continue to lower to invariant IR. Policies, effects, lifecycle, and outcome causation continue to use the existing IR structures.

## Deferred Areas

Capability-local effect declarations are deferred. Effects used by a capability must be declared at top level.

Authored event emission syntax is deferred. Event declarations remain valid, but capability emission relationships are not part of canonical v0.2 syntax.
