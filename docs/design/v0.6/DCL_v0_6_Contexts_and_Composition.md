# DCL v0.6 — Contexts & Composition

Version: v0.6 Draft Specification

---

# Overview

This document defines the Contexts & Composition model for the Declarative Capability Language (DCL).

v0.6 introduces the first formal composition mechanism for DCL and establishes how programs are organised across multiple files, contexts, and ownership boundaries.

The purpose of v0.6 is to allow DCL systems to scale beyond individual capability definitions while preserving:

- semantic clarity
- explicit ownership
- analyzability
- compiler-enforced correctness
- portability

This specification extends the language without changing the core semantic primitives.

---

# Design Goals

v0.6 must:

- support multi-file authoring
- support large capability catalogues
- preserve semantic ownership
- avoid hidden visibility
- avoid implicit dependencies
- support tooling and navigation
- remain independent of deployment structure

---

# Core Principle

A Context is the primary composition boundary of DCL.

A context is:

- not a file
- not a folder
- not a deployment unit
- not a package

A context represents a coherent area of responsibility.

Examples:

- Customer
- Billing
- Payments
- Identity
- Fulfilment

Contexts define:

- ownership
- naming
- visibility
- dependencies
- composition boundaries

---

# Context Declaration

A context may be declared using a fully-qualified name.

Example:

```dcl
context Payments.TransactionProcessing
```

or

```dcl
context Customer.Registration
```

Contexts may be nested logically.

Example:

```dcl
context Customer {

    context Registration {

        capability RegisterCustomer {
        }

    }

}
```

Equivalent fully qualified identity:

```text
Customer.Registration.RegisterCustomer
```

---

# Context Ownership

Every declaration belongs to exactly one context.

This includes:

- capability
- actor
- shape
- event
- effect
- policy
- lifecycle
- observability declaration

A declaration must not belong to multiple contexts.

Compiler error:

```text
duplicate_context_ownership
```

---

# Fully Qualified Symbol Identity

Every symbol has:

- local name
- fully qualified name

Example:

```dcl
context Payments.TransactionProcessing

capability AuthorisePayment
```

Compiler identity:

```text
Payments.TransactionProcessing.AuthorisePayment
```

The fully qualified name is the canonical symbol identity.

---

# Visibility

Visibility controls whether declarations may be referenced outside their owning context.

Declarations are either:

- local
- exposed

Local declarations are visible only within the owning context.

Exposed declarations may be referenced by dependent contexts.

---

# Exposed Symbols

Example:

```dcl
context Shared.Types {

    expose shape EmailAddress {
        value: Text required
    }

}
```

Example:

```dcl
context Shared.Events {

    expose event CustomerRegistered is CustomerRegisteredData

}
```

Only exposed declarations form the public semantic surface of a context.

---

# Dependency Declaration

Dependencies are explicit.

Example:

```dcl
context Customer.Registration

depends on Shared.Types
depends on Shared.Policies
```

Meaning:

- symbols may be referenced from those contexts
- only exposed symbols are visible
- visibility is not transitive

---

# No Transitive Visibility

Given:

```text
A depends on B
B depends on C
```

A cannot automatically reference symbols from C.

If A requires C:

```dcl
depends on C
```

must be declared explicitly.

---

# Circular Dependencies

Dependency cycles are invalid.

Example:

```text
Customer -> Billing
Billing -> Customer
```

Compiler result:

```text
ERROR: dependency_cycle
```

Cycles should be resolved through:

- shared contexts
- events
- higher-level ownership
- lifecycle coordination

---

# Multi-File Composition

Files are authoring units.

Contexts are semantic units.

A context may span:

- one file
- many files

Example:

```text
payments/
  authorise-payment.dcl
  capture-payment.dcl
  events.dcl
  policies.dcl
```

All files may contribute declarations to:

```dcl
context Payments.TransactionProcessing
```

Compiler meaning must never depend on file ordering.

---

# Context Hierarchy

Contexts may contain child contexts.

Example:

```text
Payments
├── Shared
├── TransactionProcessing
└── Settlement
```

Child contexts do not automatically inherit visibility.

All access must remain explicit.

---

# Context Responsibilities

Contexts provide:

## Ownership

Who owns a capability.

## Naming

Where a symbol lives.

## Visibility

Which symbols are externally available.

## Dependency Management

Which contexts may be referenced.

## Architectural Grouping

How capabilities are organised.

---

# Compiler Responsibilities

The compiler must:

1. Parse all source files.
2. Build context tables.
3. Build symbol tables.
4. Assign ownership.
5. Resolve dependencies.
6. Validate visibility.
7. Detect cycles.
8. Resolve references.
9. Produce Context IR.

---

# Compiler Diagnostics

## Errors

```text
undefined_context
undefined_symbol
symbol_not_exposed
dependency_cycle
duplicate_symbol
ambiguous_symbol
duplicate_context_ownership
```

## Warnings

```text
unused_dependency
folder_context_mismatch
overly_broad_dependency
```

---

# Context IR

v0.6 introduces ContextIR.

```text
ContextIR
- id
- name
- parent
- children
- declarations
- exposed_symbols
- dependencies
```

---

# Dependency IR

```text
DependencyIR
- source_context
- target_context
- referenced_symbols
```

---

# Symbol IR

```text
SymbolIR
- id
- name
- fully_qualified_name
- kind
- context
- visibility
```

---

# Analysis Passes

New compiler passes introduced in v0.6:

## Context Resolution

Resolves ownership.

## Dependency Analysis

Validates dependency graph.

## Visibility Analysis

Validates exposed symbol usage.

## Cycle Detection

Detects invalid dependency cycles.

## Context Reachability

Determines accessible symbols.

---

# Tooling Implications

## Playground

The DCL playground should provide:

- context tree
- source explorer
- dependency graph
- diagnostics
- IR visualisation

## VS Code Extension

The language server should provide:

- symbol navigation
- context navigation
- dependency graphing
- cycle diagnostics
- visibility validation

---

# Future Extensions

This specification intentionally does not define:

- policy inheritance
- ownership metadata
- deployment projection
- context-level observability
- context-level security boundaries

These may be introduced in later versions.

---

# Non-Goals

v0.6 is not:

- a package system
- a deployment model
- a runtime isolation model
- a namespace-only feature

Contexts are semantic composition boundaries.

---

# Summary

DCL v0.6 introduces Contexts & Composition as the language's first formal composition model.

Contexts:

- own declarations
- define visibility
- declare dependencies
- provide symbol identity
- support multi-file authoring
- enable compiler-validated architectural structure

This establishes the foundation for large-scale DCL systems while preserving the language principle that semantics remain explicit, analyzable, and portable.
