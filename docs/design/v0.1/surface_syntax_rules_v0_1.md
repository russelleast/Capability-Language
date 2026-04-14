# Declarative Capability Language — Surface Syntax Rules v0.1

## Overview

This document defines the **authored surface syntax rules** for the Declarative Capability Language (DCL) v0.1.

It does **not** define the full grammar or parser implementation.
It defines the current source-language direction for how humans and AI should **write** DCL.


This document exists to ensure that:

- authored source is consistent
- syntax remains subordinate to semantics
- the language feels like a real language rather than compiler IR with braces
- the Go compiler can target a stable first source form

This is a **v0.1 authoring contract**, not a final syntax specification.

---

## Design Intent

The surface language must:

- remain faithful to the semantic model
- avoid hidden behavior
- avoid positional or formatting-based meaning
- be readable in business-oriented source
- be explicit enough for compiler validation
- be structured enough for AI generation

The language is still semantics-first.
Surface syntax exists to express meaning clearly, not to invent meaning.

---

## Core Style Rules

### 1. Declaration order is free

Source files must not depend on top-down declaration order.
A declaration may reference symbols declared earlier or later in the file or module.

The compiler must resolve references after parsing.

**Implication:**

- no requirement that shapes appear before capabilities
- no requirement that effects appear before use
- no requirement that events appear before emission

---

### 2. Blocks define structure, not hidden behavior

DCL uses explicit block syntax with braces.

Example:

```dcl
capability SayHello {
  input HelloInput from User

  outcomes {
    Greeted
  }
}
```

Block structure improves readability, but behavior must still be expressed explicitly.

---

### 3. Symbolic operator scope is deliberately narrow

DCL v0.1 uses the symbolic operator `=>` **only inside `when` blocks**.

Example:

```dcl
when {
  rule NamePresent fails => MissingName
  otherwise => Greeted
}
```

Other authored relationships should prefer words rather than symbolic arrows.

Example:

```dcl
move Pending to Verified on event CustomerVerified
```

---

### 4. Colons are limited to structural declarations and named rules

The colon `:` is used only for:

- shape/event/outcome inline field declarations
- named rule declarations
- named entries in maps or role declarations

Examples:

```dcl
shape HelloInput {
  name: Text required
}
```

```dcl
rules {
  NamePresent: input.name is present
}
```

```dcl
actors {
  requester: Employee
  approver: Manager
}
```

Colons must not be used for general property syntax such as `kind`, `begin`, or `end`.

---

### 5. Human-readable keywords are preferred over symbolic shorthand

DCL v0.1 prefers readable keywords and phrases over symbolic operators.

Examples:

- `is true`
- `is false`
- `is present`
- `is not present`
- `is less than`
- `is greater than`
- `matches`
- `move Pending to Approved`

This keeps the source language closer to authored intent and further from host-language habits.

---

## Authored Vocabulary

The following words are the preferred authored forms for v0.1.

### Core declarations

- `shape`
- `actor`
- `event`
- `effect`
- `policy`
- `capability`

### Capability sections

- `input`
- `intents`
- `actors`
- `outcomes`
- `rules`
- `effects`
- `policies`
- `when`
- `emits`
- `lifecycle`

### Actor/property words

- `kind`
- `required`
- `begin`
- `end`
- `step`
- `move`
- `from`
- `after`
- `on`
- `is`

---

## Structural Syntax Rules

## Shapes

Shapes define reusable structured data.

### Shape declaration

```dcl
shape Address {
  line1: Text required
  city: Text required
  postcode: Text required
}
```

### Field rules

A shape field has the form:

```dcl
name: Type
```

or

```dcl
name: Type required
```

### Required fields

`required` marks a structurally mandatory field.
This reduces the need for simple presence rules when the requirement is structural rather than business-conditional.

### Nested shapes

A field may reference another shape.

```dcl
shape ShippingDetail {
  address: Address required
  deliveryDate: Date
}
```

### Collection types

v0.1 should support collection syntax for lists.

```dcl
items: List<OrderLine> required
```

---

## Built-in Value Types

The v0.1 authored language should support at least:

- `Text`
- `Boolean`
- `Number`
- `Date`
- `DateTime`
- `List<T>`

Additional business-centric value types may be introduced later or supplied through standard libraries.

Examples:

- `Email`
- `CustomerId`
- `Money`

These may be treated as named types or shapes depending on the wider type model.

---

## Actor Syntax Rules

Actors define participating parties in business behavior.

### Actor declaration

```dcl
actor Customer {
  kind human
}
```

### Actor kinds

The source language must support more than human initiators.
Typical authored values include:

- `human`
- `external_system`
- `internal_system`
- `automated_agent`
- `scheduled_agent`

These remain authored categories; the compiler may normalize them internally.

---

## Event Syntax Rules

Events represent immutable facts.

An event often declares a structured data shape.
Because event declarations commonly focus on their data, the language should not require an unnecessary nested subsection like `payload {}` when no other common subsection is present.

### Event with named shape

```dcl
event CustomerRegistered is CustomerRegisteredData
```

### Event with inline shape

```dcl
event CustomerRegistered is {
  customerId: CustomerId required
  email: Email required
}
```

This allows event declarations to remain concise while still being semantically distinct from plain shapes.

---

## Outcome Syntax Rules

Outcomes may be plain named result classes or may carry structured data.

This means the authored language supports outcome forms equivalent to a discriminated union.

### Plain outcome

```dcl
outcomes {
  MissingName
}
```

### Outcome with named shape

```dcl
outcomes {
  Greeted is GreetingResult
}
```

### Outcome with inline shape

```dcl
outcomes {
  Greeted is {
    message: Text required
  }
}
```

This is an important v0.1 feature because it allows result classes to be explicit and finite while also supporting typed payloads.

---

## Capability Syntax Rules

Capabilities are the authored unit of business responsibility.

## Single-intent shorthand

For a capability with a single primary intent, the preferred shorthand is:

```dcl
input HelloInput from User
```

This avoids unnecessary duplication between the capability name and an inline intent name.

### Example

```dcl
capability SayHello {
  input HelloInput from User

  outcomes {
    Greeted
  }
}
```

---

## Multiple intents

When a capability has multiple input variants or distinct business attempts, use an `intents` block.

```dcl
capability CustomerRegistration {
  intents {
    start with RegisterCustomerInput from Customer
    resendVerification with ResendVerificationInput from Customer
  }
}
```

This is the scaling form for multi-intent capabilities.

---

## Multiple actors within a capability

A capability may involve multiple named actor roles.

```dcl
actors {
  requester: Employee
  approver: Manager
}
```

These named roles may then be referenced in rules or policies.

Example:

```dcl
rules {
  SelfApprovalNotAllowed:
    actors.requester is not equal to actors.approver
}
```

---

## Rules Syntax Rules

Rules express business conditions in a readable condition language.
Internally they correspond to semantic invariants.

### Single-line rule

```dcl
rules {
  TermsAccepted: input.acceptedTerms is true
}
```

### Multi-line rule

```dcl
rules {
  ValidContact:
    input.email is present
    or input.phone is present
}
```

### Mixed-line rule

```dcl
rules {
  Eligible:
    input.email is present and input.acceptedTerms is true
    and not input.isBlocked is true
}
```

### Rule line-breaking rule

A rule expression may span multiple lines.
A newline does **not** terminate a rule expression while the expression remains syntactically incomplete.

These two forms are equivalent:

```dcl
ValidContact: input.email is present or input.phone is present
```

```dcl
ValidContact:
  input.email is present
  or input.phone is present
```

### Rule expression operators and predicates

v0.1 should support at least:

- `and`
- `or`
- `not`
- `is true`
- `is false`
- `is present`
- `is not present`
- `matches`
- `is less than`
- `is greater than`
- `is equal to`
- `is not equal to`

This keeps rules readable and avoids host-language symbolic habits such as `==` and `!=`.

---

## Effects Syntax Rules

Effects declare externally meaningful actions.

### Effect declaration

```dcl
effect SendVerification {
  kind notify
}
```

### Effect use inside capabilities

```dcl
effects {
  SaveRegistration
  SendVerification after SaveRegistration
}
```

`after` expresses explicit ordering without relying on source order alone.

---

## Policy Syntax Rules

Policies are declared separately and attached explicitly.

### Policy declaration

```dcl
policy SafeRetry {
  kind retry
}
```

### Capability policy attachment

```dcl
policies {
  CustomerAuthorization
  SafeRetry applies to effect ReversePayment
}
```

This wording is preferred over looser phrasing because it makes the attachment target explicit.

---

## Causation Syntax Rules (`when`)

The `when` block is the authored location for explicit outcome causation.
This is the only place where `=>` is used.

### Example

```dcl
when {
  rule NamePresent fails => MissingName
  otherwise => Greeted
}
```

### Sources of causation in authored syntax

v0.1 should support at least:

- rule failure
- effect completion or failure
- policy decision
- intent selection
- explicit fallback

Examples:

```dcl
when {
  rule TermsAccepted fails => TermsNotAccepted
  effect SendVerification failed => VerificationDeferred
  policy CustomerAuthorization denies => NotAllowed
  otherwise => Accepted
}
```

### `otherwise`

`otherwise` means no earlier causation rule in the same `when` block matched.

Constraints:

- must appear at most once
- must appear last
- compiler should reject multiple or misplaced `otherwise` branches

---

## Emits Syntax Rules

Event emission stays explicit.

```dcl
emits {
  Accepted => CustomerRegistered
}
```

Because `=>` is allowed only inside `when`, v0.1 may alternatively normalize emission syntax later to a word-based form if needed.
However, the current authoring direction may retain this form if emission is treated as a compact declarative mapping.

**Open question:**
A later revision may replace this with a word-based form such as:

```dcl
emits {
  Accepted emits CustomerRegistered
}
```

For now, this remains a provisional area.

---

## Lifecycle Syntax Rules

Lifecycle should be declared **inside the capability by default**.
This keeps lifecycle ownership local and reduces the risk of accidental implicit sharing.

### Lifecycle block

```dcl
lifecycle {
  begin Pending
  end Verified
  end Rejected

  step Pending
  step Verified
  step Rejected

  move Pending to Verified on event CustomerVerified
  move Pending to Rejected on outcome VerificationDeferred
}
```

### Lifecycle vocabulary

- `begin` defines the initial lifecycle position
- `end` defines terminal positions
- `step` defines available states/phases
- `move X to Y` defines transitions

### Why local lifecycle is preferred in v0.1

Keeping lifecycle inside the capability:

- makes ownership explicit
- keeps capability evolution and lifecycle evolution coupled in source
- simplifies compiler validation of transitions and reachable triggers

Shared lifecycles, if ever supported, should be an advanced later feature rather than the default model.

---

## Consistency Rules

The following consistency rules apply across v0.1 surface syntax.

### 1. Free declaration order
No top-down semantic dependency based on source order.

### 2. One symbolic causation operator
`=>` is reserved for causation inside `when`.

### 3. Word-based transitions
Lifecycle transitions use words, not arrows.

### 4. `is` supports named or inline result/data forms
Used for events and outcomes.

### 5. Structural requiredness belongs in shapes
Use `required` on shape properties instead of turning every presence check into a rule.

### 6. Rules are readable first
Rules may be single-line or multi-line without changing their meaning.

---

## Example 1 — Hello World

```dcl
actor User {
  kind human
}

shape HelloInput {
  name: Text required
}

shape GreetingResult {
  message: Text required
}

capability SayHello {
  input HelloInput from User

  outcomes {
    Greeted is GreetingResult
    MissingName
  }

  rules {
    NamePresent: input.name is present
  }

  when {
    rule NamePresent fails => MissingName
    otherwise => Greeted
  }
}
```

---

## Example 2 — Registration with deferred outcome

```dcl
actor Customer {
  kind human
}

effect SaveRegistration {
  kind persist
}

effect SendVerification {
  kind notify
}

policy SafeRetry {
  kind retry
}

shape RegisterCustomerInput {
  email: Email required
  acceptedTerms: Boolean required
}

event CustomerRegistered is {
  customerId: CustomerId required
  email: Email required
}

capability RegisterCustomer {
  input RegisterCustomerInput from Customer

  outcomes {
    Accepted
    TermsNotAccepted
    VerificationDeferred
  }

  rules {
    TermsAccepted:
      input.acceptedTerms is true
  }

  effects {
    SaveRegistration
    SendVerification after SaveRegistration
  }

  policies {
    SafeRetry applies to effect SendVerification
  }

  when {
    rule TermsAccepted fails => TermsNotAccepted
    effect SendVerification failed => VerificationDeferred
    otherwise => Accepted
  }

  lifecycle {
    begin Pending
    end Verified
    end Rejected

    step Pending
    step Verified
    step Rejected

    move Pending to Verified on event CustomerVerified
    move Pending to Rejected on outcome VerificationDeferred
  }
}
```

---

## Example 3 — Multi-actor capability

```dcl
actor Employee {
  kind human
}

actor Manager {
  kind human
}

shape LeaveRequestInput {
  startDate: Date required
  endDate: Date required
}

capability RequestLeave {
  input LeaveRequestInput from Employee

  actors {
    requester: Employee
    approver: Manager
  }

  outcomes {
    Requested
    InvalidDates
    SelfApprovalAttempt
  }

  rules {
    DatesValid:
      input.startDate is less than input.endDate
      or input.startDate is equal to input.endDate

    SelfApprovalNotAllowed:
      actors.requester is not equal to actors.approver
  }

  when {
    rule DatesValid fails => InvalidDates
    rule SelfApprovalNotAllowed fails => SelfApprovalAttempt
    otherwise => Requested
  }
}
```

---

## Non-Goals for v0.1

This document does not yet define:

- full formal grammar
- parser precedence table
- full type system
- imports/modules syntax
- generic type syntax
- code generation surface mapping
- shared lifecycle reuse syntax
- full event metadata syntax

These may be added in later versions once the current surface language is proven against scenarios and compiler experiments.

---

## Summary

DCL v0.1 surface syntax aims to be:

- friendly enough to author
- explicit enough to analyze
- structured enough to compile
- consistent enough to scale

The most important v0.1 surface rules are:

- free declaration order
- `input X from Y` for single-intent shorthand
- `intents {}` for multi-intent capabilities
- `required` on shape properties
- readable rule expressions using words
- `=>` only inside `when`
- `is` for named or inline event/outcome data
- lifecycle declared inside capability by default

---

Version: v0.1
