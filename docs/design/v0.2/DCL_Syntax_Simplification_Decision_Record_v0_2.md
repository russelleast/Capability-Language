# DCL Decision Record — v0.2 Syntax Simplification

## Status
Accepted for v0.2

## Date
2026-06-10

## Context

DCL v0.1 established the initial semantic model and first authored surface syntax. The semantics are now sufficiently clear to review the syntax against the language goals.

The review found that v0.1 syntax is directionally correct but still contains inconsistencies and unnecessary ceremony inherited from early exploration. These inconsistencies make the language slightly harder to read, harder to teach, and more awkward for compiler implementation.

The purpose of v0.2 is therefore not to expand DCL semantics. It is to simplify and regularise the authored syntax so the compiler can move forward on a cleaner source form.

Policy and context expansion are deliberately deferred to v0.2+.

---

## Decision

DCL v0.2 will focus on syntax simplification only.

The compiler will be updated to support the revised syntax. Additional examples will be created to validate the syntax against existing v0.1 semantics.

No major semantic expansion is included in v0.2.

---

## Goals

v0.2 syntax should be:

- more concise
- easier to read
- more internally consistent
- less operator-driven
- closer to capability behaviour
- easier for humans and AI to author correctly
- easier for the compiler to parse and validate

---

## Non-Goals

v0.2 will not introduce:

- expanded policy semantics
- context/dependency semantics
- new lifecycle supervision semantics
- UI description syntax
- new execution/runtime model
- new policy taxonomy
- environment/profile syntax

Those areas belong to v0.2+.

---

## Syntax Decisions

### 1. Replace `input` with `intent`

The v0.1 syntax used `input` for single-intent capabilities and `intents` for multi-intent capabilities.

This created two authored forms for the same semantic concept.

#### v0.1

```dcl
capability SayHello {
  input HelloInput from User
}
```

#### v0.2

```dcl
capability SayHello {
  intent HelloInput from User
}
```

The word `intent` better matches the semantic primitive and avoids treating the input shape as the capability attempt itself.

---

### 2. Use `rule` as the authored term

The semantic model may continue to compile authored rules into invariant-like IR structures, but the source language should use the word `rule`.

`rule` is easier to understand than `invariant` for business authors, architects, testers, and AI-assisted authoring.

#### v0.2

```dcl
rule TermsAccepted:
  input.acceptedTerms is true
```

---

### 3. Remove symbolic operators from authored causation

DCL should avoid symbolic operators where they may carry different meanings from other languages.

The v0.1 `=>` operator is removed from authored syntax.

#### v0.1

```dcl
when {
  rule TermsAccepted fails => TermsNotAccepted
}
```

#### v0.2

```dcl
when {
  TermsAccepted violated then TermsNotAccepted
}
```

The keyword `then` expresses outcome selection without relying on symbolic syntax.

---

### 4. Keep `when`, but refine causation wording

The `when` block is retained because it clearly signals conditional outcome selection.

However, v0.1 wording such as `fails` is too ambiguous.

Different primitive types should use causation words that match their semantics:

- rule violated
- effect unresolved
- policy denied
- otherwise

#### v0.2

```dcl
when {
  TermsAccepted violated then TermsNotAccepted
  SendVerification unresolved then VerificationDeferred
  CustomerAuthorization denied then NotAllowed
  otherwise then Accepted
}
```

The compiler resolves whether each symbol is a rule, effect, policy, or other valid causation source. Repeating the primitive type in the `when` block is not required unless ambiguity exists.

---

### 5. Make declarations concise with `is`

Declarations that classify a primitive should use a concise `is` form rather than nested `kind` blocks.

#### v0.1

```dcl
actor Customer {
  kind human
}

effect SendVerification {
  kind notify
}

policy SafeRetry {
  kind retry
}
```

#### v0.2

```dcl
actor Customer is human

effect SendVerification is notify

policy SafeRetry is retry
```

This creates a consistent declaration style across actors, effects, policies, events, and outcome payloads.

---

### 6. Effects declare their type where they are declared

Effect declarations should include their type directly.

Effects may be declared globally where reuse is required, but capability-local effects should be supported and encouraged for simple capabilities.

#### v0.2

```dcl
effect SaveRegistration is persist
effect SendVerification is notify after SaveRegistration
```

Inside a capability:

```dcl
capability RegisterCustomer {
  effect SaveRegistration is persist
  effect SendVerification is notify after SaveRegistration
}
```

---

### 7. Use the v0.1+ lifecycle refinement

Lifecycle syntax should use the streamlined v0.1+ direction.

#### v0.1

```dcl
lifecycle {
  begin Pending
  end Verified
  step Pending
  step Verified
}
```

#### v0.2

```dcl
lifecycle {
  begin step Pending
  step Verified
  end step Rejected
}
```

This makes `begin` and `end` modifiers of lifecycle steps rather than separate declarations.

---

### 8. Avoid `emits` as a section name

The word `emits` does not feel right as a first-class authored section and also caused inconsistency with symbolic operator usage.

The v0.2 syntax should use event emission wording based on `when` / `then` or another word-based form.

Candidate direction:

```dcl
when {
  Accepted then event CustomerRegistered
}
```

Or:

```dcl
event CustomerRegistered after Accepted
```

This remains a small open syntax decision for v0.2 examples, but symbolic emission mappings should be avoided.

---

## Example — Register Customer v0.2 Draft

```dcl
actor Customer is human

policy SafeRetry is retry

shape RegisterCustomerInput {
  email: Email required
  acceptedTerms: Boolean required
}

event CustomerRegistered is {
  customerId: Id required
  email: Email required
}

capability RegisterCustomer {
  intent RegisterCustomerInput from Customer

  outcome Accepted
  outcome TermsNotAccepted
  outcome VerificationDeferred

  rule TermsAccepted:
    input.acceptedTerms is true

  effect SaveRegistration is persist
  effect SendVerification is notify after SaveRegistration

  apply SafeRetry to SendVerification

  when {
    TermsAccepted violated then TermsNotAccepted
    SendVerification unresolved then VerificationDeferred
    otherwise then Accepted
  }

  lifecycle {
    begin step Pending
    step Verified
    end step Rejected

    move Pending to Verified when Accepted
    move Pending to Rejected when VerificationDeferred
  }
}
```

---

## Compiler Impact

The compiler must be updated to support:

- `intent` replacing single-intent `input`
- singular primitive declarations inside capabilities
- `actor X is Y`
- `effect X is Y`
- `policy X is Y`
- `when` causation using `then`
- primitive-specific causation words such as `violated`, `unresolved`, and `denied`
- lifecycle step modifiers such as `begin step` and `end step`

The compiler should reject or warn on deprecated v0.1 syntax once the migration path is defined.

---

## Compatibility

v0.2 is a breaking syntax change from v0.1.

The underlying semantics remain aligned with v0.1.

A migration tool or compiler diagnostic mode may be added later to convert v0.1 examples into v0.2 syntax.

---

## Deferred to v0.2+

The following are explicitly deferred:

- policy as architectural envelope
- policy families and SLO syntax
- context hierarchy
- visibility and dependency semantics
- multi-file composition rules
- richer lifecycle supervision
- observability syntax

---

## Consequences

### Positive

- Source becomes easier to read.
- Syntax better matches semantics.
- Operators are removed from core authoring.
- Compiler grammar becomes more regular.
- Examples become shorter and clearer.
- The language feels less like configuration and more like a real capability language.

### Trade-offs

- v0.1 source examples require migration.
- Some causation vocabulary still needs finalisation.
- Event emission syntax needs one more pass.

---

## Summary

DCL v0.2 is a syntax simplification release.

It keeps the v0.1 semantic model intact while replacing inconsistent and verbose syntax with a cleaner, more readable, operator-free source form.

The next expansion track, v0.2+, will focus on policy and context semantics.
