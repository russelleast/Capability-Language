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

## Capability Allocation View

`capability-allocation-view.puml` is a derived functional architecture projection. It groups DCL capabilities into business capability areas and shows the C4 containers, services, data stores, eventing components, and external systems that primarily realise or support each capability.

C4 remains the structural source of truth. DCL remains the behavioural/capability source of truth. The allocation view is generated from LLM analysis over both sources, using semantic evidence from names, responsibilities, effects, events, relationships, lifecycle transitions, and the previous prompt findings.

This view is not a manual mapping file. Its purpose is to help answer: which systems, services, and containers contain or support business logic related to this capability?

PlantUML is the preferred rendering for this view because the layout uses nested business capability areas, typed elements, a legend, and cross-capability flow links. Mermaid is useful for quick flowcharts, but the equivalent Mermaid layout became less readable as a screenshot because repeated infrastructure elements and nested groups dominated the diagram.

`capability-fragmentation-heatmap.puml` is a second derived view that ranks capabilities by fragmentation level: low, medium, high, or cross-cutting.

## Capability Map And Implementation Overlay

`capability-map.puml` is the pure functional/capability view. It shows business capability areas and DCL capabilities only. It does not require the reader to know the C4 model, and it intentionally excludes containers, services, databases, event stores, event buses, queues, object storage, and read/write stores.

`capability-implementation-overlay.puml` uses the same capability layout and adds the business-logic implementation layer. The smaller labels show the C4 services, containers, or external systems that directly implement or execute business behaviour for each capability.

Technical infrastructure is intentionally excluded from the overlay. Infrastructure such as `Event Bus`, `Event Store`, `Query Store`, `Media Storage`, and databases remains important for impact analysis, reliability, and consistency reasoning, but it is not part of this functional implementation view.

The goal of these two diagrams is to recreate the kind of functional view architects often draw manually: first the business capability map, then an overlay showing where the business logic currently lives.

## Files

- `capability-container-correlation.mmd` - Mermaid flowchart showing DCL capabilities, inferred C4 realisers, and Prompt 1 confidence scores.
- `capability-container-correlation.puml` - PlantUML version of the same correlation diagram for architecture tooling compatibility.
- `capability-allocation-view.puml` - PlantUML functional architecture view allocating DCL capabilities to C4 business areas, containers, services, stores, eventing, and external systems.
- `capability-fragmentation-heatmap.puml` - PlantUML heatmap ranking capabilities by fragmentation level.
- `capability-map.puml` - PlantUML functional capability map with business capability areas and DCL capabilities only.
- `capability-implementation-overlay.puml` - PlantUML overlay showing which services, containers, or external systems implement business logic for each capability.
- `media-item-lifecycle.mmd` - Mermaid state diagram based on the DCL `MediaItemLifecycle`.
- `video-processing-flow.mmd` - Mermaid communication view of video analysis, parallel thumbnail generation/transcoding, approval, and publication.
- `end-to-end-sequence.mmd` - Mermaid sequence diagram for the upload-to-playback analytics journey.
- `fragmented-capabilities.mmd` - Mermaid capability/ownership map showing Prompt 2 fragmented capabilities and participating C4 containers.
