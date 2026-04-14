# Declarative Capability Language — Compiler Duties & Compilation Model v0.1

## Overview

This document defines the **role, responsibilities, and structure of the compiler** for the declarative capability language.

The compiler is not merely a syntax validator. It is the **guardian of semantic correctness**, responsible for ensuring that a capability definition is:

- complete  
- unambiguous  
- internally consistent  
- analyzable  
- portable across runtime targets  

The compiler produces a **validated semantic model** from which all executable and non-executable artifacts are derived.

---

## Purpose of the Compiler

The compiler exists to:

- transform declarative source into a **validated semantic execution model**
- reject **ambiguity, incompleteness, and contradiction**
- enforce **language contracts**
- derive **execution semantics**
- generate **artifacts** (code, tests, diagrams, documentation)

---

## Compilation Phases

### 1. Parsing
- Validate grammar
- Build AST

### 2. Symbol Resolution
- Resolve references
- Detect undefined symbols
- Enforce scoping

### 3. Semantic Validation
- Enforce primitive contracts
- Validate relationships
- Ensure required elements

### 4. Ambiguity Analysis
- Detect indistinguishable outcomes
- Detect conflicting transitions
- Detect unclear policies/actors

### 5. Soundness Analysis
- Detect dead ends
- Detect unreachable states
- Detect contradictory invariants
- Ensure valid execution paths

### 6. Portability & Target Validation
- Validate runtime compatibility
- Identify degraded guarantees
- Classify portability:
  - portable
  - target-valid
  - invalid

### 7. IR Generation
Produces **Capability IR**:
- lifecycle graph
- invariant classification
- policy map
- effect graph
- event definitions

### 8. Artifact Generation
- code
- APIs
- tests
- docs
- diagrams
- observability config

---

## Compiler Diagnostics

### Errors
Invalid program:
- undefined references
- contradictions
- ambiguity

### Warnings
Valid but risky:
- unsafe retries
- weak authority

### Design Smells
Advisory:
- complex lifecycle
- unclear outcomes

---

## Core Guarantees

If compilation succeeds:
- no unresolved references
- no ambiguity
- no contradictions
- valid lifecycle
- known portability

---

## Non-Goals

The compiler must NOT:
- infer hidden behavior
- rely on runtime magic
- weaken guarantees silently

---

## AI Role

AI assists but does not validate.

**Compiler is the source of truth.**

---

## Summary

**The compiler transforms declarative capability source into a validated semantic execution model, enabling reliable system generation.**
