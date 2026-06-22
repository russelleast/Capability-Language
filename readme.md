# DCL - Declarative Capability  Language

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Build](https://github.com/russelleast/Capability-Language/actions/workflows/build.yml/badge.svg)](https://github.com/russelleast/Capability-Language/actions/workflows/build.yml)

**DCL (Declarative Capability Language)** is a language for describing software systems in terms of capabilities, intent, outcomes, effects, policies, and lifecycle progression.

Rather than modelling systems as controllers, services, endpoints, queues, or infrastructure, DCL models what a system is responsible for, what it guarantees, and what it causes.

Current versions:

* Language: v1.0
* Compiler: v0.1.0

See [version.json](version.json) for the current project versions.

DCL v1.0 defines the stable core language for describing capabilities, intents, outcomes, rules, effects, events, lifecycles, actors, policies, observations, and contexts.

## Why DCL?

Modern systems contain far more than APIs and request handlers.

They contain:

* business capabilities
* long-running processes
* event-driven interactions
* reliability requirements
* security requirements
* operational policies
* human workflows
* AI-assisted decision making

These concerns are often scattered across source code, infrastructure, documentation, tickets, and tribal knowledge.

DCL brings them together into a single declarative model.

## Example

```dcl
language dcl 1.0

actor Customer is human

effect PersistRegistration is persistence
effect SendVerificationMessage is notification

policy RegistrationReliability {
  reliability {
    retry {
      attempts 3
      backoff exponential
    }
    idempotency required
    timeout 30 seconds
  }
}

shape RegistrationInput {
  email: Email required
  acceptedTerms: Boolean required
}

event VerificationMessageSent is {
  email: Text required
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

  policies {
    RegistrationReliability governs capability
    RegistrationReliability governs effect SendVerificationMessage
    RegistrationReliability governs lifecycle
  }

  observe {
    capability duration
    outcome RegistrationAccepted count as customer_registrations_accepted
    effect SendVerificationMessage count failures as verification_send_failures
    lifecycle transitions
  }

  when {
    TermsAccepted violated then TermsRejected
    SendVerificationMessage unresolved then VerificationDeferred
    otherwise then RegistrationAccepted
  }

  lifecycle {
    begin Pending

    step Pending

    step Registered waits for event VerificationMessageSent

    end Verified
    end Failed

    move Pending to Registered
      on outcome RegistrationAccepted

    move Registered to Verified
      on event VerificationMessageSent

    move Pending to Failed
      on outcome VerificationDeferred
  }
}
```

## Core Concepts

DCL is built around a small set of first-class concepts:

* Capability
* Intent
* Outcome
* Rule
* Effect
* Event
* Lifecycle
* Policy
* Context

These concepts are analysed by the compiler and transformed into a semantic model that can be used for validation, documentation, diagrams, testing, and future runtime projections.

## Designed for Humans and AI

DCL is intended to be understandable by:

* architects
* developers
* testers
* operators
* AI systems

The language aims to reduce ambiguity and make architectural intent explicit.

## Roadmap

The broader DCL ecosystem will include:

* MCP server as the next tooling milestone
* Detailed use cases added over time
* Planned event-driven architecture use case
* Possible AI and LLM evaluation exploration after v1.0
* Continued diagram generation, documentation generation, and runtime projection work

## Contributing

Contributions, discussions, examples, and feedback are welcome.

See:

* CONTRIBUTING.md
* GOVERNANCE.md

for project contribution and governance guidance.

## License

Licensed under the Apache License 2.0.

See LICENSE for details.

## Status

DCL v1.0 defines the stable language core.

Tooling, integrations, examples, and ecosystem support continue to evolve around that stable core.

## Creator

Declarative Capability Language (DCL) was created by Russell East.
