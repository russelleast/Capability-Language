---
layout: ../../layouts/DocsLayout.astro
title: Events
description: Learn how DCL models emitted and awaited signals.
---

# Events

Events are named signals. A capability can declare events it emits, and a lifecycle can wait for events before moving to another state.

Event declarations can include payload fields. Event emission says the capability is a valid source for that event; it does not prescribe a broker, topic, schema registry, or delivery mechanism.

Events are especially useful with lifecycles, where progression depends on something observable happening.
