# Declarative Capability Language v0.1 — One Page Cheat Sheet

> **One-line model:** An actor expresses intent against a capability, governed by rules and policy, producing explicit outcomes, effects, events, and lifecycle progression.

## Core idea

DCL describes **business capabilities**, not endpoints, services, classes, controllers, queues, or infrastructure wiring.

A capability declares:

- what can be attempted
- who or what can attempt it
- what rules must hold
- what outcomes are possible
- what effects may happen
- what events are emitted
- how lifecycle progresses
- what policies govern execution

If it matters to correctness, execution, observability, reliability, or portability, it should be declared in source.

---

## Core primitives

| Primitive | Meaning |
|---|---|
| `capability` | Unit of business responsibility |
| `actor` | Human, system, agent, or scheduled initiator/participant |
| `input` / `intents` | Transport-agnostic attempt to use a capability |
| `outcomes` | Finite result classes, including failures and deferred results |
| `rules` | Business invariants / validation conditions |
| `effect` | External action: persist, notify, invoke, schedule, audit |
| `event` | Immutable fact emitted by behaviour |
| `lifecycle` | Business progression over time |
| `policy` | Operational envelope: retry, timeout, auth, audit, metrics, SLOs |
| `shape` | Structured data contract |

---

## v0.1 source style

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

## Syntax rules to remember

| Rule | v0.1 direction |
|---|---|
| Declaration order | Free; compiler resolves symbols after parsing |
| Single intent | `input Shape from Actor` |
| Multiple intents | `intents { name with Shape from Actor }` |
| Required data | Use `required` on shape fields |
| Outcome payloads | `OutcomeName is Shape` or inline shape |
| Events | `event Name is Shape` or inline shape |
| Rules | Word-based predicates: `is present`, `is true`, `is less than` |
| Causation | `=>` only inside `when` blocks |
| Effects ordering | `EffectB after EffectA` |
| Policies | Attach explicitly: `Retry applies to effect SendEmail` |
| Lifecycle | Prefer local lifecycle inside the owning capability |

---

## Outcome causation

Every reachable outcome must have an explicit cause.

Allowed causation sources:

- rule failure
- policy decision
- effect resolution
- explicit capability decision
- `otherwise` fallback, once and last

```dcl
when {
  rule TermsAccepted fails => TermsNotAccepted
  effect SendVerification failed => VerificationDeferred
  policy CustomerAuthorization denies => NotAllowed
  otherwise => Accepted
}
```

No hidden default outcome. No exception-as-contract. No implied fallback.

---

## Lifecycle pattern

```dcl
lifecycle {
  begin Pending
  step Pending
  step Verified
  end Rejected

  move Pending to Verified on event CustomerVerified
  move Pending to Rejected on outcome VerificationDeferred
}
```

For supervising lifecycles, a higher-level capability owns the lifecycle and subordinate capabilities influence it only through declared outcomes/events.

---

## Compiler checks

A successful compile should mean:

- all symbols resolve
- capabilities have input/intent and outcomes
- outcomes are reachable and distinguishable
- rules target known data/context
- effects and events are declared and attached legally
- lifecycle states and transitions are valid
- policy attachments are legal
- causation is explicit
- portability is known for the selected target

Compiler output is not just code. It can derive:

- IR
- diagnostics
- tests
- diagrams
- documentation
- observability requirements
- target runtime projections

---

## Design guardrails

DCL should reject:

- hidden behaviour by naming convention
- framework magic
- transport-specific semantics in the core language
- ambiguous outcomes
- undeclared side effects
- implicit lifecycle mutation
- policies that silently change business meaning
- runtime defaults that weaken source guarantees

---

## Mental model

Do not ask: **“What endpoint/service/class do I need?”**

Ask:

1. What capability is being expressed?
2. Who or what expresses the intent?
3. What data shape is required?
4. What rules must hold?
5. What outcomes can happen?
6. What causes each outcome?
7. What effects/events/lifecycle changes follow?
8. What policy envelope governs execution?
9. What must the compiler prove?
10. What must the runtime enforce and observe?
