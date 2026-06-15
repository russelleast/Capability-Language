---
layout: ../../layouts/DocsLayout.astro
title: Docs / Reference
description: Public reference for DCL language concepts and early semantics.
---

# Docs / Reference

This reference is the public entry point for DCL language concepts. It is intentionally compact while the language and compiler continue to evolve.

## Capability

A capability is a named responsibility of a system. It describes what the system can do in language terms, not which service or endpoint happens to implement it.

## Intent

Intent describes the input or initiating request for a capability. It can identify who or what provides the intent and what shape the intent must have.

## Outcome

Outcomes are named results. They make success, rejection, deferral, escalation, or failure explicit in the model.

## Rule

Rules capture invariants and decision constraints. A rule gives the capability a semantic boundary: some outcomes depend on rules being satisfied or violated.

## Effect

Effects describe observable changes caused by a capability. Persistence, notification, publication, charging, provisioning, and similar operations are examples of effects.

## Event

Events are named signals. A capability can emit events, and a lifecycle can wait for events before progressing.

## Policy

Policies express requirements that govern capabilities, effects, lifecycles, or broader contexts. They may describe reliability, observability, security, privacy, operational limits, or other architectural concerns.

## Lifecycle

A lifecycle describes progression through states. It connects outcomes and events to transitions, and it makes completion semantics visible.

## Public Reference Scope

This website does not replace the repository's internal design notes and ADRs. Those remain in `/docs`. Public reference material should grow here under `/website` as the language becomes easier to explain and use.
