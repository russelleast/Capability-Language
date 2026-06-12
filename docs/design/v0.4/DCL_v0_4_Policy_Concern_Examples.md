# Declarative Capability Language
# Policy Concern Examples v0.4

## Overview

This document provides complete policy examples for each v0.4 policy family.

These examples are intended to:

- clarify policy concern syntax
- guide compiler implementation
- provide acceptance examples
- act as parser and semantic validation test cases

These examples are illustrative and do not define runtime implementation.

---

# Reliability

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

## Concepts Demonstrated

- retry
- backoff
- timeout
- idempotency

---

# Availability

```dcl
policy RegisterCustomerAvailability {

    family availability

    degradation allowed

    fallback RegistrationDeferred

    dependency_tolerance required
}
```

## Concepts Demonstrated

- degradation
- fallback
- dependency_tolerance

---

# Scalability

```dcl
policy RegisterCustomerScalability {

    family scalability

    concurrency 100

    rate_limit 1000 per minute

    queue allowed

    backpressure defer
}
```

## Concepts Demonstrated

- concurrency
- rate_limit
- queue
- backpressure

---

# Performance

```dcl
policy RegisterCustomerPerformance {

    family performance

    latency p95 under 500ms

    throughput above 100 per second

    budget 1s
}
```

## Concepts Demonstrated

- latency
- throughput
- budget

---

# Security

```dcl
policy CustomerSecurity {

    family security

    authentication required

    authorization required

    classification confidential

    encryption required
}
```

## Concepts Demonstrated

- authentication
- authorization
- classification
- encryption

---

# Compliance And Governance

```dcl
policy CustomerGovernance {

    family compliance

    audit required

    retention 7 years

    approval required

    evidence required
}
```

## Concepts Demonstrated

- audit
- retention
- approval
- evidence

---

# Data Protection

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

## Concepts Demonstrated

- sensitivity
- masking
- minimization
- retention
- deletion

---

# Negative Example

The compiler should reject invalid concern combinations.

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

# Suggested Compiler Validation Rules

## Reliability

- backoff requires retry
- retry requires attempts
- timeout must be positive

## Availability

- fallback references a declared outcome
- degradation must be explicitly allowed or forbidden

## Scalability

- rate limits must be positive
- concurrency must be positive
- backpressure requires a strategy

## Performance

- latency targets must be valid
- throughput targets must be valid
- budget must be positive

## Security

- classification value must be valid

## Compliance

- retention period must be valid

## Data Protection

- sensitivity classification must be valid

---

# Acceptance Criteria

These examples should:

- parse successfully
- validate successfully
- appear in PolicyIR
- generate ConcernIR entries
- support diagnostics where appropriate

The negative example should fail compilation with a semantic validation error.

---

Version: v0.4
Status: Supporting Examples
