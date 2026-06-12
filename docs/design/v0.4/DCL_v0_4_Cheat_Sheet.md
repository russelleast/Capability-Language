# Declarative Capability Language v0.4 - Policy Concern Cheat Sheet

> **One-line model:** DCL v0.4 keeps capability as the core architectural unit and makes policy concerns first-class compiler-verifiable declarations inside policy envelopes.

## Core idea

DCL policies describe **capability execution qualities**, not infrastructure topology, cloud resources, vendor settings, legal engines, or runtime adapter configuration.

v0.4 builds on v0.3:

- v0.3 introduced policy families, policy envelopes, policy attachments, and observability
- v0.4 adds first-class policy concerns inside policy bodies
- concerns parse into AST and lower into `ConcernIR`
- concern placement, structure, parameters, conflicts, and attachment-sensitive rules are compiler-checked
- policies remain architectural envelopes around capability behaviour

---

## Policy shape

```dcl
policy RegisterCustomerReliability {
  family reliability

  retry {
    attempts 3
    backoff exponential
  }

  timeout 30s
  idempotency required
}
```

The `family` says what quality is being addressed. A concern says how that quality is expressed.

---

## Policy families and concerns

| Family | Concerns |
|---|---|
| `reliability` | `retry`, `backoff`, `timeout`, `idempotency`, `compensation`, `circuit_breaker` |
| `availability` | `degradation`, `fallback`, `dependency_tolerance` |
| `scalability` | `concurrency`, `rate_limit`, `queue`, `backpressure` |
| `performance` | `latency`, `throughput`, `budget` |
| `security` | `authentication`, `authorization`, `classification`, `encryption` |
| `compliance` / `governance` | `audit`, `retention`, `approval`, `evidence` |
| `data_protection` | `sensitivity`, `masking`, `minimization`, `retention`, `deletion` |

Concerns are valid only under their own family.

---

## Concern syntax forms

| Form | Example |
|---|---|
| Scalar concern | `timeout 30s` |
| Multi-token concern | `rate_limit 1000 per minute` |
| Block concern | `retry { attempts 3 backoff exponential }` |
| Dependency-protection block | `circuit_breaker { opens after 5 failures resets after 30s }` |

Block concerns may be written across multiple lines:

```dcl
retry {
  attempts 3
  backoff exponential
}
```

---

## Reliability

```dcl
policy RegisterCustomerReliability {
  family reliability

  retry {
    attempts 3
    backoff exponential
  }

  timeout 30s
  idempotency required
}
```

Validation:

- `retry` requires `attempts`
- `attempts` must be a positive integer
- `backoff` requires `retry`
- `timeout` must be a positive duration
- `idempotency` must be `required`, `allowed`, or `forbidden`

---

## Circuit breaker

`circuit_breaker` is reliability-only dependency protection. It protects a capability from repeatedly invoking an unhealthy external dependency through an effect.

```dcl
policy PaymentDependencyProtection {
  family reliability

  circuit_breaker {
    opens after 5 failures
    resets after 30s
  }
}

capability RegisterCustomer {
  intent RegisterCustomerInput from Customer
  outcomes { Accepted PaymentDeferred }
  effect CallPaymentGateway

  policies {
    PaymentDependencyProtection governs effect CallPaymentGateway
  }

  when {
    CallPaymentGateway unresolved then PaymentDeferred
    otherwise then Accepted
  }
}
```

Validation:

- valid only under `family reliability`
- may only govern an `effect`
- requires `opens after <positive integer> failures`
- requires `resets after <positive duration>`
- does not define half-open states, probes, failure ratios, sampling windows, exception mappings, vendor settings, library settings, or runtime adapters

---

## Availability

```dcl
policy RegisterCustomerAvailability {
  family availability

  degradation allowed
  fallback RegistrationDeferred
  dependency_tolerance required
}
```

Validation:

- `degradation` must be `allowed` or `forbidden`
- `fallback` references an outcome declared by the attached capability
- `dependency_tolerance` must be `required`, `allowed`, or `forbidden`

---

## Scalability

```dcl
policy RegisterCustomerScalability {
  family scalability

  concurrency 100
  rate_limit 1000 per minute
  queue allowed
  backpressure defer
}
```

Validation:

- `concurrency` must be positive
- `rate_limit` must be positive and use `per <unit>`
- `queue` must be `allowed` or `forbidden`
- `backpressure` requires a strategy

---

## Performance

```dcl
policy RegisterCustomerPerformance {
  family performance

  latency p95 under 500ms
  throughput above 100 per second
  budget 1s
}
```

Validation:

- `latency` target must be valid
- `throughput` target must be valid
- `budget` must be a positive duration

---

## Security

```dcl
policy CustomerSecurity {
  family security

  authentication required
  authorization required
  classification confidential
  encryption required
}
```

Validation:

- `authentication`, `authorization`, and `encryption` must be `required`, `allowed`, or `forbidden`
- `classification` must be one of the compiler-known classification values

---

## Compliance and governance

```dcl
policy CustomerGovernance {
  family compliance

  audit required
  retention 7 years
  approval required
  evidence required
}
```

Validation:

- `audit`, `approval`, and `evidence` must be `required`, `allowed`, or `forbidden`
- `retention` must be a positive period
- `compliance` and `governance` share the same concern set

---

## Data protection

```dcl
policy CustomerDataProtection {
  family data_protection

  sensitivity personal
  masking required
  minimization required
  retention 2 years
  deletion required
}
```

Validation:

- `sensitivity` must be one of the compiler-known sensitivity values
- `masking`, `minimization`, and `deletion` must be `required`, `allowed`, or `forbidden`
- `retention` must be a positive period

---

## Attachment pattern

Policies are declared at top level and attached inside capabilities.

```dcl
policy CustomerSecurity {
  family security
  authentication required
  authorization required
}

capability RegisterCustomer {
  intent RegisterCustomerInput from Customer
  outcome Accepted

  policies {
    CustomerSecurity governs capability
  }

  when {
    otherwise then Accepted
  }
}
```

Supported v0.4 attachment targets remain:

- `capability`
- `effect Name`
- `outcome Name`
- `event Name`
- `lifecycle`

`circuit_breaker` is the special case: a policy containing it may only govern an effect.

---

## Diagnostics to expect

The compiler diagnoses:

- unknown concern
- concern used under the wrong family
- malformed concern structure
- missing required concern parameter
- invalid concern value
- conflicting duplicate concerns
- unsupported concern parameter
- unresolved fallback outcome
- `backoff requires retry`
- invalid `circuit_breaker` attachment target
- invalid `circuit_breaker` opening or reset rule

Negative example:

```dcl
policy BadRetry {
  family reliability
  backoff exponential
}
```

Expected diagnostic:

```text
ERROR: backoff requires retry
```

---

## IR shape

v0.4 policy IR includes:

- `family`
- `concerns`
- `objectives`
- `attachment_points`
- `derived_obligations`

Each `ConcernIR` includes:

- `name`
- `family`
- `parameters`
- `source_location`

The compiler keeps IR deterministic.

---

## Guardrails

DCL v0.4 policy concerns must not become:

- Kubernetes HPA or replica counts
- Azure Service Bus, AWS, Istio, Envoy, or vendor-specific configuration
- autoscaling groups or deployment topology
- OAuth provider setup
- firewall rules or certificate management
- PCI, SOC, FCA, GDPR, or other legal/compliance engines
- generated runtime adapters
- service mesh policy configuration

Policy concerns describe portable capability execution qualities. The compiler is the source of truth.
