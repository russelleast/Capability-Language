# DCL v0.8 Syntax Pressure Test Pack

This pack exercises the current DCL compiler and the v0.8 lifecycle language surface. The compiler and the versioned design docs in this repository are the source of truth.

Compile each scenario independently:

```bash
for f in pressure-tests/syntax/*.dcl; do
  echo "### $f"
  go run ./cmd/dcl check "$f" 2>&1
done
```

The files are intentionally standalone. Compiling the whole directory as one module will introduce duplicate top-level declarations across scenarios.

## Scenarios

| # | File | Primary pressure |
|---|---|---|
| 01 | `01-customer-registration-baseline.dcl` | Capability basics, effects, policies, observability, local lifecycle, event wait |
| 02 | `02-order-fulfilment-supervised-lifecycle.dcl` | Multi-contributor supervising lifecycle, event and outcome transitions |
| 03 | `03-payment-deadline-local-lifecycle.dcl` | Local lifecycle waiting, deadline-caused outcome |
| 04 | `04-refund-recovery-supervised-lifecycle.dcl` | Recovery step, recovery contributor, compensation policy |
| 05 | `05-approval-decision-actors.dcl` | Actor roles, decision step, rule causation |
| 06 | `06-observability-policy-mix.dcl` | Observability and multiple policy families |
| 07 | `07-cross-context-dependency.dcl` | Context dependency and cross-context symbol use |
| 08 | `08-event-wait-source-warning.dcl` | Event source verification limitation |
| 09 | `09-async-document-review.dcl` | Long-running async review with deadline |
| 10 | `10-data-erasure-policy.dcl` | Data protection and governance concerns |
| 11 | `11-inventory-reservation.dcl` | Hold/expiry lifecycle and self-contributor wait |
| 12 | `12-shipment-exception.dcl` | Availability fallback and exception lifecycle |
| 13 | `13-claim-assessment-supervision.dcl` | Cross-capability claim supervision |
| 14 | `14-loan-origination-long-running.dcl` | Long-running underwriting wait and governance |
| 15 | `15-ai-assisted-review.dcl` | System actor contributor and human review |
| 16 | `16-subscription-renewal-lifecycle.dcl` | Renewal lifecycle, retries, deadline expiry |
| 17 | `17-unused-contributor-warning.dcl` | Contributor declared but unused |
| 18 | `18-ambiguous-transition-diagnostic.dcl` | Ambiguous transition diagnostic |
| 19 | `19-outcome-name-pressure.dcl` | Outcome names that sound like states, commands, and effects |
| 20 | `20-private-cross-context-diagnostic.dcl` | Private symbol access across context boundary |

## Recorded Diagnostics

Recorded with:

```bash
go run ./cmd/dcl check <scenario>
```

| File | Result | Diagnostics |
|---|---:|---|
| 01 | warnings | `DCL_SEM_REDUNDANT_POLICY`, `DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED` |
| 02 | warnings | `DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED` |
| 03 | warnings | `DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED` |
| 04 | ok | none |
| 05 | ok | none |
| 06 | warnings | `DCL_SEM_REDUNDANT_POLICY` |
| 07 | warnings | `DCL_SEM_REDUNDANT_POLICY` |
| 08 | warnings | `DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED` |
| 09 | warnings | `DCL_SEM_REDUNDANT_POLICY`, `DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED` |
| 10 | ok | none |
| 11 | warnings | `DCL_SEM_REDUNDANT_POLICY` |
| 12 | warnings | `DCL_SEM_REDUNDANT_POLICY`, `DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED` |
| 13 | ok | none |
| 14 | warnings | `DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED` |
| 15 | warnings | `DCL_SEM_REDUNDANT_POLICY` |
| 16 | warnings | `DCL_SEM_REDUNDANT_POLICY`, `DCL_SEM_LIFECYCLE_WAIT_EVENT_SOURCE_UNVERIFIED` |
| 17 | warnings | `DCL_SEM_LIFECYCLE_CONTRIBUTOR_UNUSED` |
| 18 | error | `DCL_SEM_AMBIGUOUS_LIFECYCLE_TRANSITION` |
| 19 | ok | none |
| 20 | error | `DCL_SEM_SYMBOL_IS_PRIVATE` |

## Notes

The warning-heavy scenarios are useful pressure tests rather than failures of the pack. They reveal current compiler behavior around event emission ownership, effective policy redundancy, and contributor usage.
