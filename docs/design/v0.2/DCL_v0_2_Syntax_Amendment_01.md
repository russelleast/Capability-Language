# DCL v0.2 Syntax Simplification Decision Record — Amendment 01

Date: 2026-06-11

## Purpose

This amendment records additional decisions made after review of the v0.2 syntax simplification decision record.

These amendments clarify policy attachment syntax and establish a consistent authoring model across capability sections.

---

## Amendment 1 — Remove `apply` Keyword

The keyword:

```dcl
apply SafeRetry to SendVerification
```

is removed from the proposed v0.2 syntax direction.

### Rationale

The word `apply` introduces an implementation-oriented action rather than expressing a semantic relationship.

DCL keywords should represent semantic concepts and relationships rather than procedural operations.

---

## Amendment 2 — Policy Attachments Remain Within a Policies Block

Policy attachment should remain within a dedicated policies section.

Example:

```dcl
policies {
  SafeRetry governs SendVerification
}
```

### Distinction

Policy declaration:

```dcl
policy SafeRetry is retry
```

Policy attachment:

```dcl
policies {
  SafeRetry governs SendVerification
}
```

---

## Amendment 3 — Consistent Singular and Block Forms

All major capability sections should support both:

- singular form
- block form

Both forms must have identical semantics.

### Outcomes

```dcl
outcome Accepted
```

or

```dcl
outcomes {
  Accepted
  Rejected
}
```

### Rules

```dcl
rule TermsAccepted:
  input.acceptedTerms is true
```

or

```dcl
rules {
  TermsAccepted:
    input.acceptedTerms is true

  CustomerActive:
    input.active is true
}
```

### Effects

```dcl
effect SendVerification is notify
```

or

```dcl
effects {
  SaveRegistration is persist
  SendVerification is notify
}
```

### Policies

```dcl
policies {
  SafeRetry governs SendVerification
}
```

---

## Amendment 4 — Section-Oriented Authoring Model

The preferred DCL authoring style continues to favour semantic sections:

- intents
- outcomes
- rules
- effects
- policies
- when
- lifecycle

Even when only a single item is declared, authors may choose either the singular form or the block form without changing meaning.

### Design Goal

This preserves:

- readability
- consistency
- compiler simplicity
- AI generation friendliness

while reducing unnecessary syntax variation.

---

## Impact on v0.2

These amendments do not introduce new semantic concepts.

They are surface syntax refinements only and therefore remain within the scope of v0.2.

Policy expansion and Context semantics remain deferred to v0.2+.
