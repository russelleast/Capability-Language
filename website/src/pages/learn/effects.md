---
layout: ../../layouts/DocsLayout.astro
title: Effects
description: Learn how DCL models observable changes caused by capabilities.
---

# Effects

Effects describe observable changes a capability may cause outside itself.

Persistence, notification, publication, charging, provisioning, and similar operations are effects. DCL can also express effect ordering, such as one effect happening after another.

Effects do not choose a database, broker, SDK, or runtime. They name the semantic change the capability is responsible for causing.
