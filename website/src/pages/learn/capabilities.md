---
layout: ../../layouts/DocsLayout.astro
title: Capabilities
description: Learn how DCL models system responsibilities as capabilities.
---

# Capabilities

A capability is a named responsibility the system exposes. It is the main unit of DCL modeling.

Capabilities should describe business or system meaning before implementation shape. `RegisterCustomer`, `RequestLeave`, and `CollectPayment` are capability names; controller names and queue names are implementation details.

Inside a capability, DCL can declare intent, actors, outcomes, rules, effects, events, policies, observations, and lifecycle progression.

See the [examples](/Capability-Language/examples/) for complete compiling capability models.
