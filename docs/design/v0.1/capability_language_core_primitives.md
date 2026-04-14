# Declarative Capability Language — Core Primitives

## Overview

This document defines the **core primitives** of the declarative capability language.

The goal is to identify the **smallest set of native concepts** required to model business systems in a way that is:

- explicit
- analyzable
- portable
- implementable by both humans and AI

This builds on the manifesto and refines the semantic core of the language.

---

## Core Interaction Model

**Actor expresses Intent against a Capability → Outcomes**

A capability:

- evaluates intent  
- enforces invariants  
- applies policy  
- produces outcomes  
- causes effects  
- emits events  
- progresses lifecycle  

---

## Semantic Primitives

These are the **first-class concepts of meaning** in the language.

### 1. Capability

The unit of business responsibility.

Defines:

- what can be done  
- under what conditions  
- what outcomes are possible  
- what effects may occur  

---

### 2. Actor

The initiating or participating party.

Represents:

- human users  
- systems  
- services  
- tenants  
- automated agents  

---

### 3. Intent

A declared attempt to use a capability.

Characteristics:

- transport-agnostic  
- may be accepted, rejected, or deferred  
- part of the contract  

---

### 4. Outcome

A declared result class of a capability.

Examples:

- success  
- failure  
- partial  
- deferred  
- rejected  

Outcomes are explicit and finite.

---

### 5. Invariant

A rule that must always hold.

Used for:

- validation  
- business constraints  
- correctness  

Enforced by compiler and/or runtime.

---

### 6. Effect

A declared interaction with the external world.

Examples:

- persistence  
- external calls  
- notifications  

Effects are explicit and observable.

---

### 7. Event

An immutable fact emitted by a capability.

Characteristics:

- structured  
- observable  
- used for integration and audit  

---

### 8. Lifecycle

Defines progression over time.

Represents:

- states or phases  
- transitions  
- long-running behavior  

---

### 9. Policy

Declares non-functional guarantees.

Examples:

- retries  
- timeouts  
- idempotency  
- authorization  
- consistency  

---

## Structural Primitives

These support the semantic model.

### Shape

Defines structured data.

### Relationship

Defines connections between elements.

### Identity

Represents uniqueness and reference.

### Value

Represents simple or composite data.

---

## Non-Primitives (Explicitly Rejected)

The following are **not core language primitives**:

- request / response  
- classes / objects  
- services / endpoints  
- exceptions  
- loops (for, while)  
- infrastructure concepts  

---

## Execution Characteristics

Instead of loops, the language supports:

- declarative repetition  
- policy-driven retries  
- lifecycle-driven progression  

---

## Summary

The language is built on:

- meaning (capability, intent, outcome, actor)  
- correctness (invariant, policy)  
- causation (effect, event)  
- progression (lifecycle)  
- structure (shape, relationship, identity, value)  

---

## One-line Model

**"An actor expresses intent against a capability, governed by invariants and policy, producing outcomes, effects, events, and lifecycle progression."**

---

Generated: 2026-04-11T22:47:25.541969Z
