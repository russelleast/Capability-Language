# Findings

## Aim

C4 explains where the system lives. DCL explains what the system is responsible for. Together, an AI can reason about capability ownership, processing flow, impact, and architectural gaps better than with either model alone.

## Lifecycle Semantics

The DCL model includes one supervising `MediaItemLifecycle` focused on the business status of a media item after upload:

- `Uploaded`
- `Analysed`
- `Processing`
- `ReadyForApproval`
- `Approved`
- `Published`
- `Rejected`
- `Failed`

The lifecycle is driven by declared capability outcomes and emitted events, rather than by container-level service calls. This keeps DCL focused on behavioural architecture while C4 remains responsible for structural orchestration.

Current DCL lifecycle syntax can express milestone transitions, waits, actor decisions, terminal states, and failure transitions. It does not yet express a guarded join such as "for video, both thumbnail generation and transcoding must complete before the item is ready for approval" while also allowing image-only content to proceed after thumbnail generation. The experiment therefore models `ReadyForApproval` as reachable from processing completion signals and leaves media-type-specific routing semantics to the C4 structure and LLM reasoning prompt.
