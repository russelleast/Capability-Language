# Declarative Capability Language v0.2 — One Page Cheat Sheet

> **One-line model:** DCL v0.2 keeps the v0.1 capability semantics, but rewrites the authored syntax into a cleaner, canonical, word-based form.

## Core idea

DCL describes **business capabilities**, not endpoints, services, classes, controllers, queues, or infrastructure wiring.

v0.2 is a **syntax simplification release**:

- concise `is` declarations for actors, effects, and policies
- `intent` replaces singular `input`
- singular and block forms are normalized the same way
- word-based causation replaces symbolic `=>`
- policy attachment uses `governs`
- lifecycle step modifiers become explicit
- v0.1 syntax is rejected, not deprecated

No major semantic expansion is included in v0.2. Policy expansion, Context semantics, capability-local effect declarations, and authored event emission relationships are deferred.

---

## Core primitives

| Primitive | Meaning |
|---|---|
| `capability` | Unit of business responsibility |
| `actor` | Human, system, agent, or scheduled initiator/participant |
| `intent` / `intents` | Transport-agnostic attempt to use a capability |
| `outcome` / `outcomes` | Finite result classes, including failures and deferred results |
| `rule` / `rules` | Business invariants / validation conditions |
| `effect` / `effects` | External action use: persist, notify, invoke, schedule, audit |
| `event` | Immutable fact declaration |
| `lifecycle` | Business progression over time |
| `policy` / `policies` | Operational envelope and attachment |
| `shape` | Structured data contract |

---

## v0.2 source style

```dcl
actor User is human

shape HelloInput {
  name: Text required
}

shape GreetingResult {
  message: Text required
}

capability SayHello {
  intent HelloInput from User

  outcomes {
    Greeted is GreetingResult
    MissingName
  }

  rule NamePresent: input.name is present

  when {
    NamePresent violated then MissingName
    otherwise then Greeted
  }
}
```

---

## Syntax rules to remember

| Rule | v0.2 direction |
|---|---|
| Declaration compatibility | v0.2 compiler accepts canonical v0.2 syntax only |
| Actor declaration | `actor Customer is human` |
| Effect declaration | Declare at top level: `effect SendVerification is notify` |
| Policy declaration | Declare at top level: `policy SafeRetry is retry` |
| Singular intent | `intent Shape from Actor` |
| Multiple intents | `intents { name with Shape from Actor }` |
| Required data | Use `required` on shape fields |
| Outcome payloads | `outcome Accepted is Shape` or block entry `Accepted is Shape` |
| Events | `event Name is Shape` or inline shape |
| Rules | `rule Name: predicate` or `rules { Name: predicate }` |
| Causation | `Name decision-word then Outcome` inside `when` blocks |
| Effects use | Use top-level effects inside capabilities: `effect SaveRegistration` |
| Effects ordering | `SendVerification after SaveRegistration` |
| Policies | Attach inside `policies`: `SafeRetry governs SendVerification` |
| Lifecycle | `begin step State`, `step State`, `end step State` |

Singular and block forms have identical semantics and normalize into the same compiler collections.

---

## Top-level declarations

```dcl
actor Customer is human

effect SaveRegistration is persist
effect SendVerification is notify

policy SafeRetry is retry

shape RegisterCustomerInput {
  email: Email required
  acceptedTerms: Boolean required
}

event CustomerRegistered is {
  customerId: CustomerId required
  email: Email required
}
```

Event declarations remain valid in v0.2, but authored event emission syntax is unresolved and deferred.

---

## Capability sections

A capability may contain:

- `intent` or `intents`
- `outcome` or `outcomes`
- `rule` or `rules`
- `effect` or `effects`
- `policies`
- `when`
- `lifecycle`
- `actors`

```dcl
capability RegisterCustomer {
  intent RegisterCustomerInput from Customer

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
    SafeRetry governs SendVerification
  }

  when {
    TermsAccepted violated then TermsNotAccepted
    SendVerification unresolved then VerificationDeferred
    otherwise then Accepted
  }
}
```

---

## Outcome causation

Every reachable outcome must still have an explicit cause.

| Decision word | Source kind | Example |
|---|---|---|
| `violated` | Rule | `TermsAccepted violated then TermsNotAccepted` |
| `unresolved` | Effect | `SendVerification unresolved then VerificationDeferred` |
| `denied` | Policy | `CustomerAuthorization denied then NotAllowed` |
| `otherwise` | Capability fallback | `otherwise then Accepted` |

```dcl
when {
  TermsAccepted violated then TermsNotAccepted
  SendVerification unresolved then VerificationDeferred
  CustomerAuthorization denied then NotAllowed
  otherwise then Accepted
}
```

`otherwise` may appear only once and must be last. There is no hidden default outcome.

---

## Lifecycle pattern

```dcl
lifecycle {
  begin step Pending
  step Verified
  end step Rejected

  move Pending to Verified on event CustomerRegistered
  move Pending to Rejected on outcome VerificationDeferred
}
```

Lifecycle transitions must reference known states and valid triggers. Triggers may reference outcomes or globally declared events.

---

## Removed v0.1 forms

The v0.2 compiler rejects:

| v0.1 form | v0.2 replacement |
|---|---|
| `input RegisterCustomerInput from Customer` | `intent RegisterCustomerInput from Customer` |
| `actor Customer { kind human }` | `actor Customer is human` |
| `effect SendVerification { kind notify }` | `effect SendVerification is notify` |
| `policy SafeRetry { kind retry }` | `policy SafeRetry is retry` |
| `rule TermsAccepted fails => TermsNotAccepted` | `TermsAccepted violated then TermsNotAccepted` |
| `otherwise => Accepted` | `otherwise then Accepted` |
| `SafeRetry applies to effect SendVerification` | `SafeRetry governs SendVerification` |
| `begin Pending` | `begin step Pending` |
| `end Verified` | `end step Verified` |
| `emits { Accepted => CustomerRegistered }` | No canonical v0.2 replacement |

---

## Compiler checks

A successful v0.2 compile should mean:

- all symbols resolve
- capabilities declare at least one intent
- capabilities declare at least one outcome
- every outcome has explicit causation
- `otherwise` appears only once and last
- rules target known data/context
- effects used by a capability resolve to top-level declarations
- effect ordering references resolve inside the capability
- policy attachments target effects used by the capability
- lifecycle states and transitions are valid
- removed v0.1 syntax has been rejected during parsing

The IR schema does not need to change for v0.2. Rules continue to lower to invariant-oriented IR, and policies, effects, lifecycle, and outcome causation continue to use existing IR structures.

---

## Design guardrails

DCL v0.2 should reject:

- hidden behaviour by naming convention
- framework magic
- transport-specific semantics in the core language
- ambiguous outcomes
- undeclared side effects
- implicit lifecycle mutation
- policies that silently change business meaning
- runtime defaults that weaken source guarantees
- v0.1 compatibility forms

---

## Mental model

Do not ask: **"What endpoint/service/class do I need?"**

Ask:

1. What capability is being expressed?
2. Who or what expresses the intent?
3. What data shape is required?
4. What rules must hold?
5. What outcomes can happen?
6. What word-based cause leads to each outcome?
7. What top-level effects are used?
8. What policies govern those effects?
9. What lifecycle changes follow?
10. What must the compiler prove?
