# ADR-0001 — Context Visibility Defaults

Status: Accepted

Version: v0.6

Date: 2026-06-13

---

# Context

DCL v0.6 introduces Contexts as the primary composition boundary for the language.

The initial v0.6 draft proposed local-by-default visibility requiring an explicit `expose` modifier.

---

# Decision

DCL adopts:

**Public by default. Private by exception.**

All declarations are visible outside their owning context unless explicitly marked as `private`.

Example:

```dcl
context Shared.Types {

    shape EmailAddress {
        value: Text required
    }

}
```

Private declaration:

```dcl
context Shared.Types {

    private shape InternalProviderToken {
        value: Text required
    }

}
```

Private declarations may only be referenced within their owning context.

---

# Rationale

## Capability Discovery

DCL is capability-first. Public-by-default improves:

- discoverability
- generated catalogues
- architecture navigation
- documentation

## AI Friendliness

Public semantic models improve:

- code generation
- architecture analysis
- semantic discovery
- tooling

## Architectural Focus

Contexts are semantic boundaries, not package boundaries.

The language should not force package-oriented concepts such as export lists as the common authoring path.

## Explicit Hiding

The more important architectural decision is often what should be hidden rather than what should be visible.

Private declarations remain available when needed.

## Reduced Ceremony

Most declarations are expected to be shared and discoverable.

Public-by-default reduces noise.

---

# Visibility Rules

## Public

Declarations without modifiers are public.

```dcl
shape CustomerId {
    value: Text required
}
```

## Private

```dcl
private shape InternalCustomerProjection {
}
```

Compiler error when referenced externally:

```text
ERROR: symbol_is_private
```

---

# Dependency Rules

Visibility does not remove dependency declarations.

```dcl
context Customer.Registration

depends on Shared.Types
```

A context may reference public declarations only from contexts it explicitly depends upon.

---

# Compiler Implications

The compiler must:

- track symbol visibility
- validate private access
- reject external references to private symbols
- preserve dependency validation
- preserve cycle detection

---

# IR Implications

```text
SymbolIR
- id
- name
- kind
- context
- visibility
```

Visibility values:

```text
public
private
```

---

# Tooling Implications

Language tooling should:

- hide private symbols from external completion
- surface visibility in navigation
- provide diagnostics for private access violations

Generated documentation should include public declarations by default.

---

# Alternatives Considered

## Local by Default with `expose`

Rejected.

Reasons:

- package-oriented mindset
- increased authoring noise
- reduced discoverability

## Explicit Public and Private

Rejected.

Example:

```dcl
public shape CustomerId
private shape InternalState
```

Reason:

- public is expected to be the common case

---

# Summary

DCL v0.6 adopts:

**Public by default. Private by exception.**

Contexts remain the ownership and dependency boundary while visibility becomes simpler, more discoverable, and more aligned with DCL's capability-first philosophy.
