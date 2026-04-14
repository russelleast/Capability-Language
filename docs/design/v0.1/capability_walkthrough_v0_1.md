# Declarative Capability Language — Capability Walkthrough v0.1

## Overview
This document walks a real capability (**RegisterCustomer**) from source through semantic normalization into Capability IR and analysis.

---

## Capability Summary
Actor registers a customer account. System validates input, persists pending registration, sends verification, and produces outcomes.

---

## Semantic Facts
- Capability: RegisterCustomer
- Intent: RegisterCustomerIntent
- Outcomes: Accepted, Rejected, Deferred
- Invariants: EmailRequired, EmailFormatValid, TermsMustBeAccepted
- Effects: PersistPendingRegistration, SendVerificationEmail
- Event: CustomerRegistrationAccepted
- Lifecycle: CustomerRegistrationLifecycle
- Policies: Authorization, Idempotency, SLO

---

## IR Snapshot (Simplified)

CapabilityIR:
- intents: RegisterCustomerIntent
- outcomes: Accepted, Rejected, Deferred
- invariants: EmailRequired, EmailFormatValid, TermsMustBeAccepted
- effects: PersistPendingRegistration, SendVerificationEmail
- lifecycle: CustomerRegistrationLifecycle
- policies: Authorization, Idempotency, SLO

---

## Execution Flow

Customer → Intent → Invariants → Policy → Outcome

Accepted:
- persist
- notify
- emit event
- move lifecycle

Rejected:
- validation/policy failure

Deferred:
- notification failure → deferred

---

## Analysis Results

### Completeness
PASS

### Ambiguity
WARNING: Rejected may represent multiple causes

### Lifecycle
WARNING: Deferred path initially undefined (fixed)

### Soundness
PASS after linking deferred to effect failure

---

## Key Learnings

- Outcome causation must be explicit
- Effect failure semantics needed
- Lifecycle triggers must bind to outcomes/events
- Rejection outcomes should be more specific

---

## Summary

This walkthrough validates IR structure and exposes next language design needs.
