---
layout: ../../layouts/DocsLayout.astro
title: Learn DCL
description: Follow a learning path for expressing architectural intent in DCL.
---

# Learn DCL

DCL is a language for expressing architectural intent. The learning path starts with modelling tasks, then deepens into language constructs and reference material.

The useful question is not "what does this term mean?" It is:

> How do I express this system responsibility, decision, integration, policy, or lifecycle in DCL source?

## Learning Path

### 1. Start With One Responsibility

Write a capability that names a responsibility, the intent that starts it, and the outcomes it can produce.

- [How do I define a capability?](/Capability-Language/guides/define-capability/)
- [Capability concept](/Capability-Language/learn/capabilities/)
- [Intent concept](/Capability-Language/learn/intent/)
- [Outcome concept](/Capability-Language/learn/outcomes/)

### 2. Add Meaningful Decisions

Use rules and outcome causation to model validation and authorisation as language semantics rather than prose or hidden code paths.

- [How do I model validation?](/Capability-Language/guides/model-validation/)
- [How do I model authorisation?](/Capability-Language/guides/model-authorisation/)

### 3. Model Observable Work

Declare the effects, integrations, events, and observations that make behaviour visible and analyzable.

- [How do I model effects and integrations?](/Capability-Language/guides/model-effects-integrations/)
- [How do I observe a capability?](/Capability-Language/guides/observe-capability/)
- [Effects concept](/Capability-Language/learn/effects/)
- [Events concept](/Capability-Language/learn/events/)

### 4. Add Operational Intent

Attach policies to the right semantic boundary so reliability, security, governance, and performance requirements become part of the model.

- [How do I define reliability policies?](/Capability-Language/guides/define-reliability-policies/)
- [Policies concept](/Capability-Language/learn/policies/)

### 5. Model Progression And Composition

Use lifecycles when work progresses over time, and contexts when a model needs ownership and dependency boundaries.

- [How do I define a lifecycle?](/Capability-Language/guides/define-lifecycle/)
- [How do I split a model into contexts?](/Capability-Language/guides/split-model-contexts/)
- [Lifecycles concept](/Capability-Language/learn/lifecycles/)
- [Contexts concept](/Capability-Language/learn/contexts/)

## After The Path

Use the [Examples](/Capability-Language/examples/) section for complete validated models, and the [Reference](/Capability-Language/docs/) when you need precise construct-level detail.
