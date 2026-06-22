---
layout: ../../layouts/DocsLayout.astro
title: Policies
description: Learn how DCL expresses architectural and operational concerns.
---

# Policies

Policies express requirements that govern language elements.

A policy can describe concerns such as reliability, performance, security, governance, data protection, confidence, or observability. It can then govern a capability, effect, event, outcome, or lifecycle.

Policies keep cross-cutting requirements visible in the model instead of burying them in prose or implementation-specific configuration.

Confidence policies use the existing family syntax:

```dcl
policy MinimumAnswerConfidence {
  family confidence
  threshold 0.8
}
```

The threshold is a number between `0` and `1`. It defines a boundary for accepting a decision, effect, outcome, or tool result; it is not a full LLM evaluation or grounding model.
