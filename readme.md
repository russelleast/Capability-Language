# DCL - Declarative Capability  Language

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Build](https://github.com/russelleast/Capability-Language/actions/workflows/build.yml/badge.svg)](https://github.com/russelleast/Capability-Language/actions/workflows/build.yml)

**DCL (Declarative Capability Language)** is a declarative programming language for describing software systems in terms of business capabilities rather than infrastructure.

Instead of modelling controllers, services, APIs, queues, or deployment concerns, DCL models what a system is responsible for, what it guarantees, and what effects it causes.

The compiler validates architectural intent and produces a semantic model that can generate documentation, diagrams, tests, runtime projections, and AI-consumable representations from a single source.

DCL is designed for architects, software engineers and AI systems to collaborate using a single, unambiguous architectural language.

## Features

- Capability-first modelling
- Declarative architectural intent
- Semantic compiler with diagnostics
- AI-friendly language design
- VS Code extension
- MCP server for AI tooling
- Capability diagrams and visualisation
- Portable execution model
- Documentation and test generation

## Current versions:

* Latest language: v1.1 (compiler supports 1.0 and 1.1)
* Compiler: v1.1.0

See [version.json](version.json) for the current project versions.

For local AI-assisted DCL analysis, download `dcl-mcp` from the dedicated `mcp-v*` GitHub Releases or run `make install-mcp` from a source checkout. See the [DCL MCP server setup guide](docs/mcp.md). The local stdio MCP server exposes compiler-backed tools for validation, compilation, IR inspection, diagnostics explanation, version metadata, and semantic summaries.

DCL Language 1.0 defines the stable core. DCL Language 1.1 adds the expanded type system: `Integer`, measures and measured numerics, numeric constraints, enum shapes, and typed enum cases. DCL Compiler 1.1 compiles both contracts according to each source file's `language` declaration.

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

DCL Language 1.0 defines the stable language core; DCL Language 1.1 extends its type system.

Tooling, integrations, examples, and ecosystem support continue to evolve around that stable core.

## Creator

Declarative Capability Language (DCL) was created by Russell East.
