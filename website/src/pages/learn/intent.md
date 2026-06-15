---
layout: ../../layouts/DocsLayout.astro
title: Intent
description: Learn how DCL describes requests that initiate capabilities.
---

# Intent

Intent describes what initiates a capability. It connects an input shape to the actor that provides the request.

The shape names the data the capability expects. The actor identifies who or what is asking for the capability.

Intent is deliberately semantic. It says what the capability receives, not whether that request arrives through HTTP, a queue, a function call, or another transport.
