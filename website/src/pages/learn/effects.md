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
effect SearchKnowledgeBase is tool
```

The current examples use the noun-based kinds `persistence`, `notification`, `invocation`, and `tool`. Legacy spellings such as `persist`, `notify`, and `invoke` are accepted by the compiler with warnings and normalized to the noun forms.

`tool` marks a declared tool-use boundary, such as an MCP tool, function call, retrieval tool, or agent tool. It does not add model, provider, or runtime semantics.
