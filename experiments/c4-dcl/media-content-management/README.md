# C4 + DCL Media Content Management Experiment

This experiment models the same media content management system in two complementary ways:

- `workspace.dsl` describes the container-level C4 structural architecture.
- `media-content-management.dcl` describes the behavioural capability architecture.
- `prompts/` contains LLM prompts for correlating the two models without a manual mapping file.

C4 describes structural architecture. DCL describes capability behaviour. The experiment tests whether an LLM can correlate both representations without a manual mapping file.

## Scenario

The system lets users upload batches of video, image, audio, and microsite package content through a web portal. Users assign attributes and tags during upload. A file analyser detects media type, extracts metadata, and routes items into processing pipelines.

Video processing includes metadata and aspect-ratio analysis, thumbnail generation, and transcoding. Image processing includes thumbnail generation. Approved content is published into playlists using attributes and tags. Digital signage players poll for playlist versions, download playlist media assets, and send playback events. Analytics records playback counts.

The original architecture used CQRS and Event Sourcing; the DCL model keeps that behaviour visible through content events, read-model updates, and audit policies while leaving structural details to C4.

## Reproduce

From the repository root:

```bash
cd compiler
go run ./cmd/dcl check ../experiments/c4-dcl/media-content-management/media-content-management.dcl
```

Expected result:

```text
ok (DCL language 1.0)
```

`workspace.dsl` can be loaded into the C4 playground to inspect the structural model.

## Modelling Notes

The DCL model is intentionally focused on capabilities, intents, outcomes, effects, events, policies, and observable behaviour. It does not describe containers, databases, queues, deployment, or implementation wiring; those belong in the C4 model.

Current DCL syntax does not express conditional media-type routing such as "if video then thumbnail and transcode in parallel" as executable branching syntax. The model therefore records the semantic capabilities and events (`AnalyseMediaFile`, `GenerateThumbnail`, `TranscodeVideo`, `MediaFileAnalysed`, `ThumbnailGenerated`, `VideoTranscoded`) and leaves structural routing relationships to `workspace.dsl`.

No YAML, JSON, or other manual mapping file is used. Correlation is expected to come from names, responsibilities, effects, events, and prompt-driven reasoning.
