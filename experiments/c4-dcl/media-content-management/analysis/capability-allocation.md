# Capability Allocation Analysis

This file is a derived experiment output for the C4 + DCL media content management experiment.

It is not a manual mapping file and must not be treated as a source of truth. The allocation below is derived from:

- the C4 structural model in `../workspace.dsl`
- the DCL behavioural model in `../media-content-management.dcl`
- the compiler-valid DCL capability, effect, event, policy, and lifecycle declarations
- previous LLM findings recorded in `../findings.md`
- semantic evidence from names, responsibilities, effects, events, relationships, and lifecycle transitions

C4 remains the structural source. DCL remains the behavioural/capability source. This analysis is a generated functional architecture projection over both.

## Allocation Table

| Business area | DCL capability | Primary container | Supporting containers | Supporting infrastructure | Evidence | Confidence | Fragmentation |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| Manage Content | `UploadContentBatch` | `Content Management Application` with `Portal` as the user entry point | `Portal` | `Media Storage`, `Event Bus`, `Event Store`, `Query Store` | DCL effects `StoreUploadedMedia`, `AppendContentEvent`, `UpdateContentReadModel`; event `ContentBatchUploaded`. C4 relationships: `Content User -> Portal`, `Portal -> Content Management Application`, `Content Management Application -> Media Storage`, `Content Management Application -> Event Bus`, `Content Management Application -> Query Store`, `Event Bus -> Event Store`. | 0.95 | Fragmented. User interaction, command handling, asset persistence, event append, and read-model update are intentionally separated. |
| Manage Content | `ApproveContent` | `Content Management Application` with `Portal` as the user entry point | `Portal` | `Event Bus`, `Event Store`, `Query Store` | DCL outcomes `ContentApprovedForPublishing`, `ContentRejected`; event `ContentApproved`; effects `AppendContentEvent`, `UpdateContentReadModel`. C4 relationships: `Content Approver -> Portal`, `Portal -> Content Management Application`, `Content Management Application -> Event Bus`, `Content Management Application -> Query Store`, `Event Bus -> Event Store`. | 0.88 | Fragmented. Human approval interaction is separate from workflow/event-sourced command handling and projection. Role wording differs slightly between C4 and DCL. |
| Process Media | `AnalyseMediaFile` | `File Analyser Service` | None as business containers; downstream processing services are routed to after analysis | `Media Storage`, `Event Bus`, `Event Store`, `Query Store` | DCL effect `AnalyseUploadedFile`; event `MediaFileAnalysed`; effects `AppendContentEvent`, `UpdateContentReadModel`. C4 relationships: `Event Bus -> File Analyser Service`, `File Analyser Service -> Media Storage`, `File Analyser Service -> Event Bus`, `File Analyser Service -> Thumbnail Service`, `File Analyser Service -> Video Transcoding Service`. | 0.98 | Fragmented. Analysis is localised in one service, but completion depends on shared media storage, eventing, and read-model projection. |
| Process Media | `GenerateThumbnail` | `Thumbnail Service` | None as business containers | `Media Storage`, `Event Bus`, `Event Store`, `Query Store` | DCL effect `GenerateThumbnailAsset`; event `ThumbnailGenerated`; effects `AppendContentEvent`, `UpdateContentReadModel`. C4 relationships: `File Analyser Service -> Thumbnail Service`, `Thumbnail Service -> Media Storage`, `Thumbnail Service -> Event Bus`, `Event Bus -> Event Store`. | 0.97 | Fragmented. Specialist processing is localised, while asset storage, event append, and projection are shared infrastructure responsibilities. |
| Process Media | `TranscodeVideo` | `Video Transcoding Service` | None as business containers | `Media Storage`, `Event Bus`, `Event Store`, `Query Store` | DCL effect `TranscodeVideoAsset`; event `VideoTranscoded`; effects `AppendContentEvent`, `UpdateContentReadModel`. C4 relationships: `File Analyser Service -> Video Transcoding Service`, `Video Transcoding Service -> Media Storage`, `Video Transcoding Service -> Event Bus`, `Event Bus -> Event Store`. | 0.98 | Fragmented. Long-running video processing is localised, but renditions, event-sourced completion, and read-model updates are shared. |
| Cross-cutting Lifecycle / Manage Content | `ManageMediaItemLifecycle` | `Content Management Application` as best structural owner | `File Analyser Service`, `Thumbnail Service`, `Video Transcoding Service`, `Playlist Publisher` | `Event Bus`, `Event Store`, `Query Store` | DCL lifecycle `MediaItemLifecycle`; contributors `AnalyseMediaFile`, `GenerateThumbnail`, `TranscodeVideo`, `ApproveContent`, `PublishContentToPlaylist`; transitions on `MediaFileAnalysed`, `ThumbnailGenerated`, `VideoTranscoded`, `ContentApprovedForPublishing`, `ContentRejected`, `PlaylistUpdated`, and failure outcomes. C4 relationships show the event-driven chain across upload, analysis, processing, approval, and playlist publication. | 0.74 | Cross-cutting. The lifecycle is behavioural supervision over events and outcomes from many containers rather than a single service implementation. |
| Publish Content | `PublishContentToPlaylist` | `Playlist Publisher` | `Playlist Service` | `Query Store`, `Event Bus`, `Event Store` | DCL effect `PublishPlaylistVersion`; event `PlaylistUpdated`; effects `AppendContentEvent`, `UpdateContentReadModel`. C4 relationships: `Event Bus -> Playlist Publisher`, `Playlist Publisher -> Query Store`, `Playlist Publisher -> Event Bus`, `Playlist Publisher -> Playlist Service`, `Event Bus -> Event Store`. | 0.96 | Fragmented. Playlist publication combines business publication logic, projection reads, version serving, and event-sourced publication. |
| Operate Digital Signage | `ServePlaylistToPlayer` | `Playlist Service` | `Digital Signage Player` external system | `Query Store`, `Media Storage` | DCL effects `ServePlaylistVersion`, `DownloadMediaAssets`; actor `DigitalSignagePlayer`. C4 relationships: `Digital Signage Player -> Playlist Service`, `Playlist Service -> Query Store`, `Digital Signage Player -> Media Storage`. | 0.92 | Fragmented. Playlist metadata serving and media asset download are intentionally split between service, player, query store, and media storage. |
| Measure Playback | `RecordPlaybackAnalytics` | `Analytics Service` | `Digital Signage Player` external system | `Analytics Database`, `Event Bus`, optional `Event Store` | DCL effect `PersistPlaybackCount`; event `ContentPlayed`; effect `AppendContentEvent`. C4 relationships: `Digital Signage Player -> Analytics Service`, `Analytics Service -> Analytics Database`, `Analytics Service -> Event Bus`, `Event Bus -> Event Store`. | 0.95 | Fragmented. Analytics ingestion is localised, but durable counts and optional event append use separate persistence/eventing infrastructure. |

## Notes

The allocation is intentionally more functional than the C4 container view. It answers the question: which systems, services, and stores contain or support business logic for each behavioural capability?

The strongest localised allocations are the specialist processing capabilities:

- `AnalyseMediaFile` to `File Analyser Service`
- `GenerateThumbnail` to `Thumbnail Service`
- `TranscodeVideo` to `Video Transcoding Service`
- `RecordPlaybackAnalytics` to `Analytics Service`

The most fragmented allocation is `ManageMediaItemLifecycle`, because lifecycle state is a behavioural projection over upload, analysis, processing, approval, publication, rejection, and failure milestones. The C4 model does not contain a dedicated lifecycle/workflow container; the best structural owner is `Content Management Application`, with lifecycle evidence supplied by events and outcomes across several containers.

The allocation depends on semantic correlation and should be regenerated if either source model changes.
