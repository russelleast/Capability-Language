# DCL Contexts, Visibility, and Dependency Semantics v0.1+

## Overview

This document defines how DCL programs are composed across multiple source files.

It introduces:

- Contexts
- Visibility
- Dependencies
- Context hierarchy
- Compiler obligations
- Tooling implications

This document extends the existing compiler, IR, and manifesto direction.

---

# Core Principle

A context is a semantic boundary.

A context is not a file.
A context is not a folder.
A context is not a deployment unit.

A context groups related capabilities and supporting declarations into a coherent area of responsibility.

---

# Why Context Instead of Module

The term "module" carries implementation and packaging assumptions from general-purpose languages.

DCL is capability-first.

The preferred term is:

**Context**

A context represents:

- ownership
- naming
- visibility
- grouping
- architectural responsibility

---

# Context Hierarchy

Contexts may contain child contexts.

Example:

```dcl
context Customer {

  context Registration {

    capability RegisterCustomer {
    }

  }

}
```

Equivalent logical identity:

```text
Customer
└── Registration
    └── RegisterCustomer
```

Fully qualified name:

```text
Customer.Registration.RegisterCustomer
```

---

# Context Ownership

Every declaration belongs to exactly one context.

Examples:

- capability
- actor
- event
- effect
- policy
- shape

A declaration must not belong to multiple contexts.

---

# Context Visibility

Declarations are either:

- local
- exported

Local declarations are visible only within the owning context.

Exported declarations may be referenced by dependent contexts.

Example:

```dcl
context Shared.Types {

  export shape EmailAddress {
    value: Text required
  }

}
```

---

# Dependencies

Dependencies are explicit.

Example:

```dcl
context Customer.Registration

depends on Shared.Types
depends on Shared.Policies
```

Meaning:

- symbols from those contexts may be referenced
- only exported symbols are visible
- visibility is not transitive

---

# No Transitive Visibility

Given:

```text
A depends on B
B depends on C
```

A does not automatically see symbols from C.

If A requires C:

```dcl
depends on C
```

must be declared explicitly.

---

# Circular Dependencies

Context dependency cycles are invalid.

Example:

```text
Customer -> Billing
Billing -> Customer
```

Compiler result:

```text
ERROR: dependency_cycle
```

Cycles must be resolved by introducing:

- shared context
- event interaction
- higher-level capability ownership

---

# Contexts and Folder Structure

Folders may mirror contexts.

Example:

```text
/customer
  /registration
    register-customer.dcl
```

may represent:

```text
Customer.Registration
```

However:

Folder structure is not semantic truth.

Source declarations remain authoritative.

Example:

```dcl
context Customer.Registration
```

The compiler must use the declared context.

Tooling may warn when file location and declared context diverge.

---

# Files

Files are authoring units.

A context may:

- occupy one file
- occupy multiple files

A file may contain:

- one declaration
- multiple declarations

Compiler meaning must not depend on file ordering.

This remains consistent with DCL semantic principles.

---

# Symbol Resolution

The compiler must:

1. Parse all source.
2. Build symbol tables.
3. Resolve context ownership.
4. Resolve dependencies.
5. Validate visibility.
6. Detect cycles.
7. Produce normalized Context IR.

---

# Compiler Diagnostics

## Errors

- undefined_context
- undefined_symbol
- symbol_not_exported
- dependency_cycle
- duplicate_export
- ambiguous_symbol

## Warnings

- unused_dependency
- folder_context_mismatch
- overly_broad_dependency

---

# IR Impact

The existing Module Layer evolves toward a Context Layer.

## ContextIR

```text
ContextIR
- id
- name
- parent
- children
- exports
- dependencies
- declarations
```

## DependencyIR

```text
DependencyIR
- source_context
- target_context
- referenced_symbols
```

## SymbolIR

```text
SymbolIR
- id
- name
- kind
- context
- visibility
```

---

# Playground Implications

The web playground should present:

- Context tree
- Source editor
- Diagnostics
- IR view
- Dependency graph

Suggested layout:

```text
+----------------+----------------------+----------------+
| Context Tree   | Source Editor        | Diagnostics    |
|                |                      | IR             |
|                |                      | Graph          |
+----------------+----------------------+----------------+
```

---

# VS Code Implications

The language server should provide:

- context navigation
- dependency graphing
- symbol lookup
- export visibility validation
- cycle detection

---

# Future Possibilities

Contexts may later become boundaries for:

- policy inheritance
- documentation generation
- capability catalogues
- ownership metadata
- deployment projections

These are not part of v0.1+ semantics.

---

# Summary

A context is the primary composition boundary of DCL.

Contexts:

- own declarations
- define visibility
- declare dependencies
- participate in hierarchy

Folders may mirror contexts.

Source declarations remain authoritative.

All dependency relationships are explicit, analyzable, and compiler validated.
