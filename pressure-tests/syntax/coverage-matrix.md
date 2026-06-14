# Coverage Matrix

Legend: `X` means the scenario directly exercises the feature.

| File | Capabilities | Contexts | Intents | Outcomes | Rules | Effects | Events | Policies | Observability | Lifecycles | Supervising | Contributors / actors | Async / long-running | Cross-context deps |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 01 | X |  | X | X | X | X | X | X | X | X |  | X | X |  |
| 02 | X |  | X | X |  | X | X | X | X | X | X | X | X |  |
| 03 | X |  | X | X |  |  | X |  |  | X |  | X | X |  |
| 04 | X |  | X | X |  | X |  | X |  | X | X | X | X |  |
| 05 | X |  | X | X | X |  |  |  | X | X |  | X |  |  |
| 06 | X |  | X | X |  | X | X | X | X |  |  | X |  |  |
| 07 | X | X | X | X |  | X | X | X | X |  |  | X |  | X |
| 08 | X |  | X | X |  |  | X |  |  | X | X | X | X |  |
| 09 | X |  | X | X |  | X | X | X | X | X |  | X | X |  |
| 10 | X |  | X | X | X | X |  | X | X |  |  | X |  |  |
| 11 | X |  | X | X | X | X |  | X |  | X |  | X | X |  |
| 12 | X |  | X | X |  | X | X | X | X | X |  | X | X |  |
| 13 | X |  | X | X | X | X |  | X | X | X | X | X | X |  |
| 14 | X |  | X | X | X | X | X | X | X | X |  | X | X |  |
| 15 | X |  | X | X |  | X |  | X | X | X | X | X | X |  |
| 16 | X |  | X | X |  | X | X | X | X | X |  | X | X |  |
| 17 | X |  | X | X |  |  |  |  |  | X | X | X |  |  |
| 18 | X |  | X | X |  |  |  |  |  | X |  | X |  |  |
| 19 | X |  | X | X | X | X |  |  | X | X |  | X | X |  |
| 20 | X | X | X | X |  |  |  |  |  |  |  | X |  | X |

## Feature Notes

| Feature | Strongest examples |
|---|---|
| Capabilities | All scenarios |
| Contexts | 07, 20 |
| Intents | All scenarios |
| Outcomes | All scenarios |
| Rules | 01, 05, 10, 11, 13, 14, 19 |
| Effects | 01, 02, 04, 06, 09, 10, 11, 12, 13, 14, 15, 16, 19 |
| Events | 01, 02, 03, 06, 07, 08, 09, 12, 14, 16 |
| Policies | 01, 02, 04, 06, 07, 09, 10, 11, 12, 13, 14, 15, 16 |
| Observability | 01, 02, 05, 06, 07, 09, 10, 12, 13, 14, 15, 16, 19 |
| Lifecycles | 01, 02, 03, 04, 05, 08, 09, 11, 12, 13, 14, 15, 16, 17, 18, 19 |
| Supervising lifecycles | 02, 04, 08, 13, 15, 17 |
| Contributors / actors | 02, 04, 05, 08, 10, 13, 15, 17 |
| Async or long-running behavior | 02, 03, 04, 08, 09, 11, 12, 13, 14, 15, 16, 19 |
| Cross-context dependencies | 07, 20 |
