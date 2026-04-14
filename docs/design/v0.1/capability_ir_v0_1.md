# Declarative Capability Language — Capability IR v0.1

## Overview

This document defines the **Intermediate Representation (IR)** for the Declarative Capability Language (DCL).

The IR is the **canonical semantic model** produced by the compiler after parsing, resolution, and validation.

It is:

- independent of syntax
- deterministic
- analyzable
- extensible
- portable across runtime targets

---

## Purpose

The IR exists to:

- represent **true program meaning**
- separate **authored intent from derived knowledge**
- enable **compiler analysis**
- act as the **source of truth for code generation and tooling**

---

## Design Principles

### 1. Semantics over Syntax
IR must not contain syntax artifacts.

### 2. Explicit Relationships
All relationships between elements must be explicit.

### 3. Layered Model
IR is structured into distinct layers:
- Module Layer
- Semantic Layer
- Behavioral Layer
- Analysis Layer

### 4. Expandability
IR must support new primitives and analysis without breaking compatibility.

### 5. Deterministic
Same input → same IR output.

---

## IR Layers

### 1. Module Layer

Represents multi-file structure.

**Concepts:**
- Module
- Symbol
- Dependency

---

### 2. Semantic Layer

Core language constructs:

- Capability
- Actor
- Intent
- Outcome
- Invariant
- Effect
- Event
- Lifecycle
- Policy

---

### 3. Behavioral Layer

Derived execution structure:

- Capability execution graph
- Lifecycle transitions
- Effect ordering
- Event emission graph
- Policy attachment map

---

### 4. Analysis Layer

Compiler-derived facts:

- invariant classification
- reachability
- ambiguity detection
- contradiction detection
- portability classification

---

## Core IR Structures

### ProgramIR
- modules
- symbols
- capabilities
- actors
- intents
- outcomes
- invariants
- effects
- events
- lifecycles
- policies
- diagnostics

---

### CapabilityIR
- id
- name
- intents
- outcomes
- invariants
- policies
- effects
- events
- lifecycle
- actors
- relations

---

### IntentIR
- id
- name
- capability
- input shape
- actor constraints

---

### OutcomeIR
- id
- name
- classification
- payload
- effects
- events

---

### InvariantIR
- id
- target
- assertion
- scope
- enforcement type

---

### EffectIR
- id
- type
- origin
- target
- ordering
- idempotency
- retry policy

---

### EventIR
- id
- payload
- source
- correlation

---

### LifecycleIR
- id
- states
- initial state
- transitions

---

### PolicyIR
- id
- type
- category
- target
- parameters
- SLOs

---

## Authored vs Derived Data

Each IR element must distinguish:

- **Declared** (from source)
- **Normalized** (resolved by compiler)
- **Derived** (analysis output)

---

## Extensibility Rules

- New primitives must not break existing IR
- New analysis must extend, not replace
- IR must remain backward compatible

---

## Compiler Technology Strategy

### Dual-Track Approach

#### Python (Exploration Layer)

Used for:
- rapid prototyping
- IR experimentation
- semantic analysis experiments
- LLM-assisted tooling

Benefits:
- fast iteration
- flexible
- strong AI ecosystem

---

#### Go (Compiler Core)

Used for:
- production compiler
- deterministic execution
- CLI tooling
- language server

Benefits:
- static typing
- performance
- portability
- single binary deployment

---

## Tooling Vision

### 1. Web Playground
- browser-based editor
- real-time compilation
- IR visualization
- diagnostics display

### 2. VSCode Extension
- syntax highlighting
- inline diagnostics
- semantic navigation
- capability graph view

### 3. MCP Server (LLM Integration)
- expose compiler as tool
- allow LLMs to:
  - validate source
  - generate IR
  - suggest improvements
  - run analysis

---

## Non-Goals (v0.1)

- full execution engine
- backend-specific codegen
- full test framework
- infrastructure mapping

---

## Summary

**The IR is the canonical, extensible semantic model of the language, enabling validation, analysis, and system generation.**

---

Version: v0.1
