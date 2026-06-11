# DCL v0.2 Syntax Reference

## Status

Draft implementation reference for the v0.2 compiler.

## Overview

DCL v0.2 is a surface syntax refinement release. It preserves v0.1 semantics where possible while making the authored language more regular, concise, and word-based.

The v0.2 compiler accepts canonical v0.2 syntax only. Removed v0.1 forms are parse errors rather than deprecated compatibility forms.

## Top-Level Declarations

Actors, effects, and policies use concise `is` declarations:

```dcl
actor Customer is human

effect SendVerification is notify

policy SafeRetry is retry
```

Shapes and events keep their structured forms:

```dcl
shape RegisterCustomerInput {
  email: Email required
  acceptedTerms: Boolean required
}

event CustomerRegistered is {
  customerId: CustomerId required
  email: Email required
}
```

Event declarations remain valid in v0.2. Authored event emission syntax is unresolved and deferred.

## Capability Sections

A capability may contain:

- `intent` or `intents`
- `outcome` or `outcomes`
- `rule` or `rules`
- `effect` or `effects`
- `policies`
- `when`
- `lifecycle`
- `actors`

## Intents

Singular:

```dcl
intent RegisterCustomerInput from Customer
```

Block:

```dcl
intents {
  Register with RegisterCustomerInput from Customer
}
```

The singular form produces an intent named `RegisterCustomerInput`. The compiler does not create a hidden intent named `input`.

## Outcomes

Singular:

```dcl
outcome Accepted
```

Block:

```dcl
outcomes {
  Accepted
  Rejected
}
```

Outcomes may carry a payload:

```dcl
outcome Accepted is RegistrationResult
```

## Rules

Singular:

```dcl
rule TermsAccepted: input.acceptedTerms is true
```

Block:

```dcl
rules {
  TermsAccepted:
    input.acceptedTerms is true

  CustomerActive:
    input.active is true
}
```

The authored term is `rule`. The compiler may continue to lower rules into invariant-oriented IR structures.

## Effects

Effects are declared at top level and used inside capabilities:

```dcl
effect SaveRegistration is persist
effect SendVerification is notify

capability RegisterCustomer {
  effect SaveRegistration

  effects {
    SendVerification after SaveRegistration
  }
}
```

Capability-local effect declarations such as `effect SendVerification is notify` inside a capability are not part of v0.2.

## Policies

Policies are declared at top level:

```dcl
policy SafeRetry is retry
```

Policy attachments remain inside a `policies` block:

```dcl
policies {
  SafeRetry governs SendVerification
}
```

In v0.2, `governs` targets an effect used by the current capability.

## Outcome Causation

Outcome causation uses word-based relationships:

```dcl
when {
  TermsAccepted violated then TermsNotAccepted
  SendVerification unresolved then VerificationDeferred
  CustomerAuthorization denied then NotAllowed
  otherwise then Accepted
}
```

The compiler infers the causation source kind from the decision word:

- `violated` resolves to a rule
- `unresolved` resolves to an effect used by the capability
- `denied` resolves to a policy
- `otherwise` resolves to the capability fallback branch

Every outcome must still have an explicit cause.

## Lifecycle

Lifecycle steps use `begin` and `end` as step modifiers:

```dcl
lifecycle {
  begin step Pending
  step Verified
  end step Rejected

  move Pending to Verified on event CustomerRegistered
  move Pending to Rejected on outcome VerificationDeferred
}
```

Lifecycle triggers may reference outcomes or globally declared events.

## Removed v0.1 Forms

The following forms are not accepted by the v0.2 compiler:

- `input RegisterCustomerInput from Customer`
- `actor Customer { kind human }`
- `effect SendVerification { kind notify }`
- `policy SafeRetry { kind retry }`
- `rule TermsAccepted fails => TermsNotAccepted`
- `otherwise => Accepted`
- `SafeRetry applies to effect SendVerification`
- `begin Pending`
- `end Verified`
- `emits { Accepted => CustomerRegistered }`
