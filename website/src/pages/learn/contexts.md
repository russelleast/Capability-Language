---
layout: ../../layouts/DocsLayout.astro
title: Contexts
description: Learn how DCL composes models with contexts and dependencies.
---

# Contexts

Contexts group related DCL declarations and define ownership boundaries.

A context can depend on another context to make its declarations visible. This lets shared vocabulary live in one place while domain-specific capabilities remain owned by their own context.

Use contexts to keep large models understandable: shared declarations in shared contexts, domain behavior in domain contexts, and dependencies flowing in one direction.

See the [multi-file composition guide](/Capability-Language/guides/multi-file-composition/) for a compiling example.
