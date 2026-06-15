---
layout: ../../layouts/DocsLayout.astro
title: Register Customer Example
description: A small DCL example that models customer registration as a capability.
---

# Register Customer

This example models customer registration as a capability. It is intentionally small: the goal is to show language structure and semantics, not a complete production system.

```text
language dcl 0.9

actor Customer is human

effect PersistRegistration is persistence
effect SendVerificationMessage is notification

shape RegistrationInput {
  email: Email required
  acceptedTerms: Boolean required
}

event VerificationMessageSent is {
  email: Email required
}

capability RegisterCustomer {
  intent RegistrationInput from Customer

  outcomes {
    RegistrationAccepted
    TermsRejected
    VerificationDeferred
  }

  rule TermsAccepted: input.acceptedTerms is true

  effects {
    PersistRegistration
    SendVerificationMessage after PersistRegistration
  }

  events {
    emits VerificationMessageSent
  }

  when {
    TermsAccepted violated then TermsRejected
    SendVerificationMessage unresolved then VerificationDeferred
    otherwise then RegistrationAccepted
  }
}
```

## What It Says

The model says that registration is a named system capability. A customer provides registration intent. The capability may accept the registration, reject it because terms were not accepted, or defer verification if the message effect cannot be resolved.

The example does not say which framework, queue, database, or deployment platform implements the behavior. Those are implementation concerns outside this first language sketch.
