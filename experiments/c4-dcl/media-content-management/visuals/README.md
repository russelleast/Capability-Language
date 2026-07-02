# Visuals

These diagrams are generated communication artefacts from the C4 + DCL media content management experiment findings.

They are intended for blog posts, LinkedIn posts, website pages, and review discussions where a compact visual is easier to scan than the full C4 and DCL source.

## Source of Truth

- C4 structural source: `../workspace.dsl`
- DCL behavioural source: `../media-content-management.dcl`
- Correlation analysis source: `../findings.md`

The correlation and fragmentation diagrams are derived from the LLM analysis already recorded in `../findings.md`. They are not a manual mapping file and should not be treated as a source of truth.

If the C4 model, DCL model, or findings change, regenerate or update these diagrams from those sources rather than editing them as authoritative architecture data.

## Fragmented Capabilities

`fragmented-capabilities.mmd` visualises the fragmented capabilities discovered by Prompt 2.

C4 provides the structural containers and systems. DCL provides the behavioural capabilities. The LLM-derived Prompt 2 result identifies where a capability spans multiple containers, services, external actors, and data stores.

This visual is intended for communication and discussion. It is not a new source of truth and does not replace either `../workspace.dsl` or `../media-content-management.dcl`.

## Files

- `capability-container-correlation.mmd` - Mermaid flowchart showing DCL capabilities, inferred C4 realisers, and Prompt 1 confidence scores.
- `capability-container-correlation.puml` - PlantUML version of the same correlation diagram for architecture tooling compatibility.
- `media-item-lifecycle.mmd` - Mermaid state diagram based on the DCL `MediaItemLifecycle`.
- `video-processing-flow.mmd` - Mermaid communication view of video analysis, parallel thumbnail generation/transcoding, approval, and publication.
- `end-to-end-sequence.mmd` - Mermaid sequence diagram for the upload-to-playback analytics journey.
- `fragmented-capabilities.mmd` - Mermaid capability/ownership map showing Prompt 2 fragmented capabilities and participating C4 containers.
