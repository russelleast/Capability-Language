# Declarative Capability Language — Supervising Lifecycle Semantics v0.1+

## Overview

This document defines the semantics of **supervising lifecycles** in DCL.

A supervising lifecycle is a lifecycle owned by a higher-level capability that coordinates
progression across multiple subordinate capabilities.

---

## Core Definition

A supervising lifecycle is:

- owned by a single capability
- responsible for progression of a business instance
- advanced by explicitly declared outcomes or events
- analyzable and verifiable by the compiler

---

## Key Principles

### 1. Single Ownership
Each lifecycle instance must have exactly one owning capability.

### 2. Explicit Causation
All transitions must explicitly declare:
- source kind (outcome or event)
- source capability
- source symbol

Example:
move Pending to InProgress on outcome JobStarted from StartJob

### 3. No Implicit State Mutation
Subordinate capabilities must not mutate lifecycle state directly.

They may only influence progression via declared outcomes or events.

### 4. Correlated Identity
All external triggers must correlate to a specific lifecycle instance.

### 5. Policy-Governed Repetition
Retry, delay, and repetition behavior are governed by policy.

### 6. Business-Level Progression
Lifecycle steps represent business-relevant states, not technical steps.

---

## Orchestration Model

Supervising lifecycles follow an orchestration model:

- A parent capability owns the lifecycle
- Subordinate capabilities perform work
- Their outcomes/events drive lifecycle transitions

---

## Example: Job Management

capability JobManagement {

  lifecycle {
    begin step Pending
    step InProgress
    step Retrying
    end step Completed
    end step Failed

    move Pending to InProgress
      on outcome JobStarted from StartJob

    move InProgress to Retrying
      on outcome JobRetryScheduled from RetryJob

    move Retrying to InProgress
      on outcome JobRestarted from StartJob

    move InProgress to Completed
      on outcome JobCompleted from CompleteJob

    move InProgress to Failed
      on outcome JobFailed from FailJob
  }
}

---

## Subordinate Capability Rules

Subordinate capabilities may:
- produce outcomes
- emit events
- report progress

They must not:
- directly mutate lifecycle state
- introduce undeclared transitions

---

## Compiler Obligations

The compiler must:

- validate lifecycle ownership
- validate transition sources
- ensure reachability
- detect ambiguity
- ensure terminal state correctness
- enforce correlation requirements

---

## Runtime Obligations

The runtime must:

- track lifecycle instance state
- validate transitions before applying
- enforce policies
- emit observability data
- reject invalid transitions

---

## IR Implications

Additional IR requirements:

- transition source references (capability + symbol)
- lifecycle ownership linkage
- correlation binding rules
- cross-capability reachability analysis

---

## Non-Goals

This document does not define:

- choreography semantics
- execution engine design
- infrastructure orchestration

---

## Summary

A supervising lifecycle enables a capability to coordinate progression across multiple capabilities
while preserving explicit causation, analyzability, and semantic clarity.

---

Version: v0.1+
