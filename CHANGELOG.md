# Changelog

## DCL v1.0 Stable Core

DCL v1.0 defines the stable core language for describing capabilities, intents, outcomes, rules, effects, events, lifecycles, actors, policies, observations, and contexts.

- Promotes the language core to stable status.
- Sets current examples, docs, snippets, and playground samples to `language dcl 1.0`.
- Keeps tooling roadmap work separate from language stability: MCP server is the next tooling milestone, detailed use cases will be added over time, an event-driven architecture use case is planned, and AI/LLM evaluation may be explored after v1.0.

## DCL v0.10 Agentic Vocabulary

- Added `agent` as an actor kind using existing `actor Name is agent` syntax.
- Added `tool` as an effect kind for declared tool-use boundaries.
- Added `confidence` as a policy family with a required numeric `threshold` between `0` and `1`.
- Added the validated `agentic-customer-support.dcl` example.
