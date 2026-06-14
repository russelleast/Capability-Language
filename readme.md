# DCL - Declarative Capability  Language

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)


**DCL (Declarative Capability Language)** is a language for describing business systems in terms of capabilities, intent, outcomes, effects, policies, and lifecycle progression.

Rather than modelling systems as controllers, services, endpoints, or infrastructure, DCL models what a system is responsible for, what it guarantees, and what it causes.

```text
Intent → Capability → Outcomes
                    ↘ Effects
                    ↘ Events
                    ↘ Lifecycle
```

## Why DCL?

Modern systems contain far more than request handlers and API endpoints.

They contain:

* business capabilities
* long-running processes
* events and integrations
* operational policies
* observability requirements
* reliability guarantees

These concerns are often scattered across source code, configuration, infrastructure, documentation, and tribal knowledge.

DCL brings them together into a single declarative model.

A DCL source file can describe:

* what a capability does
* who may invoke it
* what outcomes are possible
* what effects occur
* what events are emitted
* how lifecycle progression works
* which operational policies apply

The goal is to make systems:

* explicit
* analyzable
* portable
* understandable by both humans and AI

## Example

```dcl
capability RegisterCustomer {
  intent RegisterCustomerIntent from Customer

  outcomes {
    Accepted
    EmailAlreadyRegistered
  }

  rules {
    EmailAvailable:
      input.email is available
  }

  when {
    rule EmailAvailable fails then EmailAlreadyRegistered
    otherwise then Accepted
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

## Current Status

DCL is under active development.

The language, compiler, and tooling are evolving through a versioned design process based on:

* manifesto-driven language design
* decision records
* semantic-first modelling
* compiler-enforced validation

Feedback and discussion are welcome.

## Roadmap

Planned ecosystem components include:

* Documentation website
* Interactive playground
* VS Code extension
* Language Server Protocol (LSP)
* Diagram generation
* AI-assisted authoring
* Multi-runtime projections

## Contributing

Contributions, discussions, issue reports, and feedback are welcome.

See:

* CONTRIBUTING.md
* GOVERNANCE.md

for contribution and project governance information.

## License

Licensed under the Apache License 2.0.

See LICENSE for details.

## Creator

Declarative Capability Language (DCL) was created by Russell East.
