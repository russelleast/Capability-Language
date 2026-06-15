# DCL - Declarative Capability  Language

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Build](https://github.com/russelleast/Capability-Language/actions/workflows/build.yml/badge.svg)](https://github.com/russelleast/Capability-Language/actions/workflows/build.yml)

**DCL (Declarative Capability Language)** is a language for describing software systems in terms of capabilities, intent, outcomes, effects, policies, and lifecycle progression.

Rather than modelling systems as controllers, services, endpoints, queues, or infrastructure, DCL models what a system is responsible for, what it guarantees, and what it causes.

Current versions:

* Language: v0.9
* Compiler: v0.1.0

See [version.json](version.json) for the current project versions.

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
capability RegisterCustomer {

  intent RegisterCustomerIntent
    from Customer

  outcomes {
    Registered
    EmailAlreadyRegistered
  }

  rules {
    EmailAvailable:
      email is available
  }

  when {
    rule EmailAvailable fails then EmailAlreadyRegistered
    always then Registered
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

* Documentation website
* Interactive playground
* VS Code extension with language server support
* Model Content Protocol (MCP)
* Diagram generation
* AI-assisted authoring
* Multi-runtime projections

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

DCL is currently pre-1.0 and under active development.

Language syntax and semantics may evolve between releases as the language continues to mature.

## Creator

Declarative Capability Language (DCL) was created by Russell East.


