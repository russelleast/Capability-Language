---
layout: ../../layouts/DocsLayout.astro
title: Write a First Capability
description: A short guide to modeling a first DCL capability.
---

# Write a First Capability

Start with one system responsibility. Avoid beginning with service names, database tables, or HTTP routes.

## 1. Name the Capability

Choose a verb phrase that describes the responsibility:

```text
capability RegisterCustomer {
}
```

## 2. Define the Intent

Intent says what initiates the capability:

```text
actor Customer is human

capability RegisterCustomer {
  intent RegistrationInput from Customer
}
```

## 3. Name Outcomes

Outcomes should make meaningful paths explicit:

```text
outcomes {
  RegistrationAccepted
  TermsRejected
  VerificationDeferred
}
```

## 4. Add Rules and Effects

Rules express constraints. Effects describe changes the capability may cause:

```text
rule TermsAccepted: input.acceptedTerms is true

effects {
  PersistRegistration
  SendVerificationMessage after PersistRegistration
}
```

## 5. Select Outcomes

The `when` block connects semantic conditions to outcomes:

```text
when {
  TermsAccepted violated then TermsRejected
  SendVerificationMessage unresolved then VerificationDeferred
  otherwise then RegistrationAccepted
}
```

## Next Step

Read the [register customer example](/Capability-Language/examples/register-customer/) to see these pieces in a complete capability sketch.
