# Prompt 6 - Capability Allocation View

You are given two architectural descriptions of the same system.

The first is a C4 model describing the structural architecture.
The second is a DCL model describing the behavioural/capability architecture.

Create a structured capability allocation analysis that maps DCL capabilities onto the C4 structural hierarchy.

Do not use or invent a manual mapping file.

Derive the allocation from:

- C4 software systems, containers, responsibilities, and relationships
- DCL capabilities, actors, intents, outcomes, effects, events, policies, and lifecycle
- existing experiment findings, if available
- semantic evidence: names, responsibilities, effects, events, relationships, and lifecycle transitions

For each DCL capability, identify:

- which business capability area it belongs to
- which C4 software system/container is the primary structural realiser
- which C4 containers are supporting participants
- which data stores/eventing components are supporting infrastructure
- which DCL effects/events provide evidence for the allocation
- which C4 relationships provide evidence
- what confidence score applies
- whether the capability is localised or fragmented
- why it is fragmented, if applicable

Suggested business areas:

- Manage Content
- Process Media
- Publish Content
- Operate Digital Signage
- Measure Playback
- Cross-cutting Lifecycle / Manage Content

Return the result in Markdown using this table structure:

| Business area | DCL capability | Primary container | Supporting containers | Supporting infrastructure | Evidence | Confidence | Fragmentation |
| --- | --- | --- | --- | --- | --- | ---: | --- |

Keep the evidence concise but specific. Mention DCL effects/events and C4 relationships directly where useful.

The result is derived analysis for the experiment. It is not a source-of-truth mapping file.
