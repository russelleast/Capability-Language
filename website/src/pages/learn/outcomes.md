---
layout: ../../layouts/DocsLayout.astro
title: Outcomes
description: Learn how DCL models explicit capability results.
---

# Outcomes

Outcomes are named results a capability can produce.

DCL encourages explicit outcome names for success, rejection, deferral, failure, escalation, and other meaningful paths. That makes behavior easier to review than a single generic success or error result.

Outcome causation is declared in a `when` block. Current syntax supports conditional branches and `always then` for unconditional outcomes.
