---
layout: ../../layouts/DocsLayout.astro
title: Learn DCL
description: Start learning Declarative Capability Language from its core ideas.
---

# Learn DCL

DCL is a language for describing software systems in terms of capabilities and their semantics.

The useful starting point is not syntax. It is the question a capability answers:

> What responsibility does this system expose, what intent can ask for it, and what outcomes can result?

## Core Model

A DCL model describes:

- **Capabilities**: named responsibilities the system provides.
- **Intent**: the request, input, or desire a capability accepts.
- **Outcomes**: explicit results the capability can produce.
- **Rules**: invariants and constraints that make outcomes meaningful.
- **Effects**: changes the capability may cause outside itself.
- **Events**: signals the model can emit or wait for.
- **Policies**: requirements such as reliability, security, observability, or governance.
- **Lifecycle progression**: the states and transitions that describe longer-running work.

## Semantics Over Syntax

DCL is intended to make architectural meaning inspectable. A DCL file should explain what a capability means before anyone asks which controller, queue, database, or runtime implements it.

That makes the language useful for documentation, design review, validation, diagram generation, tests, and future runtime projections.

## Suggested Path

1. Read the [reference](/Capability-Language/docs/) for the language concepts.
2. Follow the [first capability guide](/Capability-Language/guides/first-capability/).
3. Browse the [examples](/Capability-Language/examples/) to see complete capability sketches.
4. Check the [playground placeholder](/Capability-Language/playground/) for planned interactive tooling.
