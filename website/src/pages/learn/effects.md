---
layout: ../../layouts/DocsLayout.astro
title: Effects
description: Learn how DCL models observable changes caused by capabilities.
---

# Effects

Effects describe observable changes a capability may cause outside itself.

Persistence, notification, publication, charging, provisioning, and similar operations are effects. DCL can also express effect ordering, such as one effect happening after another.

Effects do not choose a database, broker, SDK, or runtime. They name the semantic change the capability is responsible for causing.

Effect declarations use:

```dcl
effect PersistOrder is persistence
effect SendReceipt is notification
effect CallPaymentGateway is invocation
```

The current v0.9 examples use the noun-based kinds `persistence`, `notification`, and `invocation`. Legacy spellings such as `persist`, `notify`, and `invoke` are accepted by the compiler with warnings and normalized to the noun forms.
