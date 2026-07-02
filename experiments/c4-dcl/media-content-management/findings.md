# Findings

## Aim

C4 explains where the system lives. DCL explains what the system is responsible for. Together, an AI can reason about capability ownership, processing flow, impact, and architectural gaps better than with either model alone.

## Lifecycle Semantics

The DCL model includes one supervising `MediaItemLifecycle` focused on the business status of a media item after upload:

- `Uploaded`
- `Analysed`
- `Processing`
- `ReadyForApproval`
- `Approved`
- `Published`
- `Rejected`
- `Failed`

The lifecycle is driven by declared capability outcomes and emitted events, rather than by container-level service calls. This keeps DCL focused on behavioural architecture while C4 remains responsible for structural orchestration.

Current DCL lifecycle syntax can express milestone transitions, waits, actor decisions, terminal states, and failure transitions. It does not yet express a guarded join such as "for video, both thumbnail generation and transcoding must complete before the item is ready for approval" while also allowing image-only content to proceed after thumbnail generation. The experiment therefore models `ReadyForApproval` as reachable from processing completion signals and leaves media-type-specific routing semantics to the C4 structure and LLM reasoning prompt.

## Prompt 1

Prompt 1 asked the LLM to identify which C4 containers appear to realise each DCL capability without using a predefined mapping file. The analysis used semantic correlation only: names, responsibilities, effects, events, and C4 relationships.

Structurizr MCP inspection was used for the C4 DSL and the DCL compiler summary was used for the behavioural model. Structurizr reported modelling hygiene issues such as missing relationship technologies and a disconnected `Signage Viewer`, but those did not prevent capability/container correlation.

| DCL capability | Likely C4 containers | Confidence | Reasoning |
| --- | --- | ---: | --- |
| `UploadContentBatch` | `Portal`, `Content Management Application`, `Media Storage`, `Event Bus`, `Event Store`, `Query Store` | 0.95 | User upload starts in `Portal`; `Content Management Application` handles commands, metadata, CQRS, and event sourcing. Effects map cleanly: `StoreUploadedMedia` to `Media Storage`, `AppendContentEvent` to `Event Bus`/`Event Store`, and `UpdateContentReadModel` to `Query Store`. |
| `AnalyseMediaFile` | `File Analyser Service`, `Media Storage`, `Event Bus`, `Event Store`, `Query Store` | 0.98 | Direct responsibility match. The C4 file analyser analyses uploaded files, detects media type, extracts metadata, reads media storage, and publishes analysis events. DCL mirrors this with `AnalyseUploadedFile`, `MediaFileAnalysed`, event append, and read-model update. |
| `GenerateThumbnail` | `Thumbnail Service`, `Media Storage`, `Event Bus`, `Event Store`, `Query Store` | 0.97 | Direct service-name and responsibility match. C4 thumbnail generation writes generated thumbnails to `Media Storage` and publishes thumbnail events. DCL has `GenerateThumbnailAsset`, `ThumbnailGenerated`, event append, and read-model update. |
| `TranscodeVideo` | `Video Transcoding Service`, `Media Storage`, `Event Bus`, `Event Store`, `Query Store` | 0.98 | Direct responsibility match. C4 video transcoding writes playback-ready renditions to `Media Storage` and publishes transcoding events. DCL has `TranscodeVideoAsset`, `VideoTranscoded`, event append, and read-model update. |
| `ApproveContent` | `Portal`, `Content Management Application`, `Event Bus`, `Event Store`, `Query Store` | 0.88 | Approval is user-facing through `Portal`, while `Content Management Application` owns approval workflow, CQRS, and event sourcing. DCL event/read-model effects align with event and query stores. Confidence is slightly lower because C4 says `Content User` can review/approve, while DCL uses `ContentApprover`. |
| `ManageMediaItemLifecycle` | `Content Management Application`, plus `File Analyser Service`, `Thumbnail Service`, `Video Transcoding Service`, `Playlist Publisher`, `Event Bus`, `Event Store`, `Query Store` | 0.74 | This is behavioural supervision rather than a single structural component. The lifecycle is driven by outcomes/events from analysis, processing, approval, and publishing. `Content Management Application` is the best structural owner because it owns metadata, workflow, CQRS, and event sourcing, but the lifecycle spans several processing containers. |
| `PublishContentToPlaylist` | `Playlist Publisher`, `Query Store`, `Event Bus`, `Playlist Service`, `Event Store` | 0.96 | Strong match. C4 says `Playlist Publisher` accepts approved content, reads attributes and playlist projections from `Query Store`, publishes playlist update events to `Event Bus`, and publishes versions to `Playlist Service`. DCL effects/events are `PublishPlaylistVersion`, `PlaylistUpdated`, `AppendContentEvent`, and `UpdateContentReadModel`. |
| `ServePlaylistToPlayer` | `Playlist Service`, `Query Store`, `Media Storage`, external `Digital Signage Player` | 0.92 | Players poll `Playlist Service`; `Playlist Service` reads `Query Store`; players download media assets from `Media Storage`. DCL effects `ServePlaylistVersion` and `DownloadMediaAssets` align. Confidence is slightly reduced because asset download is structurally shown as player-to-media-store rather than mediated by `Playlist Service`. |
| `RecordPlaybackAnalytics` | `Analytics Service`, `Analytics Database`, `Event Bus`, optionally `Event Store` | 0.95 | Strong match. C4 says `Digital Signage Player` pushes `ContentPlayed` events to `Analytics Service`; analytics persists counts in `Analytics Database` and optionally appends playback events to `Event Bus`. DCL has `ContentPlayed`, `PersistPlaybackCount`, `PlaybackRecorded`, and audit on the event. |

Overall, the DCL capabilities correlate well with the C4 containers without a manual mapping file. The cleanest mappings are the processing and publishing capabilities. `ManageMediaItemLifecycle` is intentionally fuzzier because it is a behavioural lifecycle spanning several C4 containers rather than a container-level service.

## Prompt 2

Prompt 2 asked the LLM to identify DCL capabilities that appear to be implemented across multiple C4 containers. The analysis again used semantic correlation only: names, responsibilities, effects, events, and C4 relationships. No manual mapping file was used or inferred.

The strongest fragmentation signals were DCL capabilities whose effects or events require more than one C4 container to realise the behaviour. In most cases the fragmentation appears intentional because the C4 model separates user interaction, command handling, event sourcing, media storage, asynchronous processing, and read-model/query responsibilities.

| DCL capability | Participating C4 containers | Why it spans containers | Intentional or accidental? | Architectural risks |
| --- | --- | --- | --- | --- |
| `UploadContentBatch` | `Portal`, `Content Management Application`, `Media Storage`, `Event Bus`, `Event Store`, `Query Store` | Upload begins in the web portal, command handling and CQRS/event-sourcing logic live in the content application, source media is stored in media storage, events are published/appended, and read models are updated for later query/use. | Intentional. This is a classic split between UI, command handling, persistence, event publication, and read models. | Upload success depends on several consistency boundaries. Risks include partial failure between media storage and event append, read-model lag, idempotency requirements for retries, and unclear ownership of `ContentBatchUploaded` if event bus and event store responsibilities diverge. |
| `AnalyseMediaFile` | `File Analyser Service`, `Media Storage`, `Event Bus`, `Event Store`, `Query Store` | The analyser reads uploaded media, performs analysis, publishes `MediaFileAnalysed`, appends content events, and updates projections/read models. | Intentional. Analysis is asynchronous and decoupled from upload through events. | The capability depends on reliable event delivery from upload and reliable event publication after analysis. Risks include analysis lag, duplicate analysis attempts, unsupported media handling not being explicitly represented in DCL, and read-model/event-store consistency drift. |
| `GenerateThumbnail` | `Thumbnail Service`, `Media Storage`, `Event Bus`, `Event Store`, `Query Store` | Thumbnail generation is performed by a dedicated processing service, writes generated assets to media storage, emits `ThumbnailGenerated`, and contributes to content read-model/event state. | Intentional. Media processing is separated from core content command handling. | Risks include thumbnail/event ordering problems, generated asset orphaning if event append fails, retries requiring idempotent asset writes, and ambiguity around whether read-model update is owned by the thumbnail service or a downstream projection handler. |
| `TranscodeVideo` | `Video Transcoding Service`, `Media Storage`, `Event Bus`, `Event Store`, `Query Store` | Video transcoding is a dedicated long-running processing responsibility, writes playback renditions to media storage, emits `VideoTranscoded`, and updates event/read-model state. | Intentional. Video transcoding is specialised and naturally isolated from upload and approval flows. | Risks include long-running job monitoring, duplicate rendition generation, storage/event consistency, back-pressure on event consumers, and unclear failure recovery semantics beyond `TranscodeDeferred`. |
| `ApproveContent` | `Portal`, `Content Management Application`, `Event Bus`, `Event Store`, `Query Store` | Approval is initiated by a human through the portal, handled by the content application, captured as event-sourced workflow state, and reflected in query/read models. | Mostly intentional. The UI/application/event-store split is expected. | There is a small modelling mismatch: C4 says `Content User` can review and approve, while DCL uses `ContentApprover`. Risks include authorisation ambiguity, approval state races if projections lag, and unclear rejection publication semantics because only `ContentApproved` is modelled as an event. |
| `ManageMediaItemLifecycle` | `Content Management Application`, `File Analyser Service`, `Thumbnail Service`, `Video Transcoding Service`, `Playlist Publisher`, `Event Bus`, `Event Store`, `Query Store` | The lifecycle is behavioural supervision over outcomes/events produced by analysis, processing, approval, and publishing. No single C4 service performs every transition; the state emerges from event-sourced milestones across containers. | Intentional as a behavioural model, but not represented as a distinct C4 container. | This is the highest-risk fragmentation point. Risks include unclear lifecycle ownership, difficulty enforcing state transitions across asynchronous services, guarded-join limitations for video processing, and possible disagreement between lifecycle state, event store, and read models. |
| `PublishContentToPlaylist` | `Playlist Publisher`, `Query Store`, `Event Bus`, `Event Store`, `Playlist Service` | The publisher consumes approved content, reads attributes and playlist projections, emits playlist update events, and publishes playlist versions into the playlist service. | Intentional. Playlist publication is decoupled from approval and serving. | Risks include stale tag/projection reads, duplicate playlist updates, ordering/version conflicts, and split ownership between `Playlist Publisher` and `Playlist Service` over what counts as the authoritative playlist version. |
| `ServePlaylistToPlayer` | `Playlist Service`, `Query Store`, `Media Storage`, `Digital Signage Player` | The player polls the playlist service, playlist service reads version/player assignments, and the player downloads media assets from media storage. | Intentional. Serving playlist metadata and serving/downloading media assets are separate concerns. | Risks include playlist/media consistency problems if assets are unavailable when a playlist version is served, cache/version skew on players, and ambiguity because DCL models `DownloadMediaAssets` inside the capability while C4 shows direct player-to-media-store download. |
| `RecordPlaybackAnalytics` | `Analytics Service`, `Analytics Database`, `Event Bus`, optionally `Event Store` | The analytics service receives `ContentPlayed`, persists playback counts, and can append/publish playback events. | Intentional. Analytics is separated from playback and content management. | Risks include event/count duplication, at-least-once delivery effects on analytics counts, optional event append making audit completeness unclear, and SQL write failures causing `AnalyticsWriteDeferred`. |

`ManageMediaItemLifecycle` is the most fragmented capability because it is not an implementation service so much as an event-driven behavioural view over the whole media item journey. That is useful for DCL, but it highlights a structural question for C4: whether lifecycle ownership sits in `Content Management Application`, emerges from event projections, or should be made explicit as a workflow/process manager.

The processing capabilities (`AnalyseMediaFile`, `GenerateThumbnail`, `TranscodeVideo`) are also fragmented, but in a more intentional way. Their boundaries align with the C4 model's asynchronous processing architecture: each processing service owns specialist work, while event publication, media storage, event sourcing, and read-model projection are shared architectural mechanisms.

## Prompt 3

Prompt 3 asked for an architectural consistency review between the C4 structural model and the DCL behavioural model. The comparison used names, responsibilities, effects, events, actors, and relationships only. No manual mapping file was used.

Overall, the two models are strongly aligned. The main business capabilities in DCL have plausible structural realisers in C4, and most DCL effects/events can be explained by C4 containers and relationships. The most useful findings are not "missing everything" problems; they are smaller alignment gaps where one model is more precise than the other.

| Area | Finding | Severity | Evidence | Suggested follow-up |
| --- | --- | --- | --- | --- |
| Actors | `Signage Viewer` appears only in C4 and is disconnected. | Low | C4 defines `Signage Viewer` as a person who views signage screens, but DCL has no equivalent actor because playback viewing is outside the behavioural capability model. Structurizr MCP also flagged the person as disconnected/not included in views. | Either remove `Signage Viewer` from this experiment, connect it to `Digital Signage Player`, or explicitly document that it is out of DCL scope. |
| Actors | C4 says `Content User` can review and approve content, while DCL separates `ContentApprover`. | Medium | C4 `Content User` description says "Uploads, attributes, reviews, and approves media content"; C4 also defines `Content Approver`. DCL uses `ContentUser` for upload and `ContentApprover` for approval. | Clarify roles in C4: either make approval solely `Content Approver`, or add DCL authorisation/actor modelling for users who can also approve. |
| Capabilities | `ManageMediaItemLifecycle` has no obvious dedicated C4 container. | Medium | DCL defines a supervising lifecycle over analysis, processing, approval, publication, rejection, and failure. C4 has no workflow/process-manager container; the closest structural owner is `Content Management Application` plus event/read-model infrastructure. | Decide whether lifecycle ownership is an application responsibility, an event-sourced projection, or a distinct workflow/process manager. If it remains conceptual, document that DCL owns the behavioural lifecycle view. |
| Capabilities | C4 portal says users can create playlists, but DCL does not model an explicit manual playlist-management capability. | Low | C4 `Portal` description includes "create playlists"; DCL only models `PublishContentToPlaylist`, which uses content attributes/tags to find/create/update playlists after approval. | Either narrow the C4 portal wording to publication/playlist assignment, or add a future DCL capability if manual playlist management is in scope. |
| Effects | `DownloadMediaAssets` is inside DCL `ServePlaylistToPlayer`, but C4 shows direct `Digital Signage Player -> Media Storage`. | Medium | DCL models `ServePlaylistToPlayer` with effects `ServePlaylistVersion` then `DownloadMediaAssets`. C4 has player polling `Playlist Service`, then player downloading media assets directly from `Media Storage`. | Clarify whether `DownloadMediaAssets` is performed by the player as part of the behavioural capability, or by a service. The DCL effect name is semantically useful but structurally spans outside `Playlist Service`. |
| Effects | `UpdateContentReadModel` appears in many DCL capabilities, but C4 only has generic relationships to `Query Store`. | Low | DCL repeatedly declares read-model update effects after event append. C4 says `Content Management Application` updates/reads query store and `Playlist Publisher`/`Playlist Service` read it, but projection ownership is not explicit. | Optionally add a projection responsibility to `Content Management Application` or document that read-model projection is an event-sourced mechanism rather than a separate container. |
| Events | DCL has `ContentRejected` as an approval outcome but no `ContentRejected` event. | Medium | DCL `ApproveContent` can produce `ContentRejected`; lifecycle transitions to `Rejected`, but the capability only emits `ContentApproved`. C4 says review/approval workflow exists but does not describe rejection events. | Consider adding a `ContentRejected` event to DCL if rejection should be event-sourced/auditable, or document that rejection is represented as an outcome/read-model state only. |
| Events | DCL event names map well to C4 event bus relationships, but C4 relationships do not name the events explicitly. | Low | C4 has generic "Publishes events", "Publishes media analysis events", "Publishes playlist update events", and "Optionally appends playback events". DCL names `ContentBatchUploaded`, `MediaFileAnalysed`, `ThumbnailGenerated`, `VideoTranscoded`, `ContentApproved`, `PlaylistUpdated`, and `ContentPlayed`. | For stronger structural/behavioural traceability, add event names to C4 relationship descriptions, while keeping DCL as the event source of behavioural truth. |
| Containers | `Event Store` is reached from `Event Bus`, which may blur command/event-source ownership. | Low | C4 relationship says `Event Bus -> Event Store` appends content and workflow events. DCL uses `AppendContentEvent` as a behavioural persistence effect across capabilities. | Decide whether event append is performed by applications/services before publishing, or by the bus as a model simplification. Current model is understandable but slightly ambiguous. |
| Containers | `Playlist Service` has no DCL capability of its own beyond serving and supporting publication. | Low | DCL `ServePlaylistToPlayer` maps to `Playlist Service`; `PublishContentToPlaylist` also publishes versions to it. This is consistent, but the service's ownership of playlist version state is implicit. | No immediate change needed. Could document that `Playlist Service` owns serving playlist versions, while `Playlist Publisher` owns publication decisions. |
| Policies | DCL policies are not represented structurally in C4. | Low | DCL declares reliability, audit, and performance policies. C4 has containers/relationships but no explicit policy/security/performance annotations. | Accept as an intentional modelling split: DCL carries behavioural constraints; C4 carries structure. Add C4 tags only if needed for communication. |

Capabilities with clear structural implementation:

- `UploadContentBatch`
- `AnalyseMediaFile`
- `GenerateThumbnail`
- `TranscodeVideo`
- `ApproveContent`
- `PublishContentToPlaylist`
- `ServePlaylistToPlayer`
- `RecordPlaybackAnalytics`

Containers with clear behavioural responsibility:

- `Portal`: upload and approval interaction.
- `Content Management Application`: content commands, approval workflow, event sourcing, read-model updates, and likely lifecycle ownership.
- `File Analyser Service`: `AnalyseMediaFile`.
- `Thumbnail Service`: `GenerateThumbnail`.
- `Video Transcoding Service`: `TranscodeVideo`.
- `Playlist Publisher`: `PublishContentToPlaylist`.
- `Playlist Service`: `ServePlaylistToPlayer`.
- `Analytics Service`: `RecordPlaybackAnalytics`.
- `Media Storage`, `Event Bus`, `Event Store`, `Query Store`, and `Analytics Database`: supporting effects/infrastructure for DCL persistence, events, and asset handling.

The highest-value consistency improvements would be:

1. Resolve the `ContentUser`/`ContentApprover` approval-role ambiguity.
2. Decide whether `ManageMediaItemLifecycle` is purely a DCL behavioural view or should have an explicit C4 owner.
3. Clarify `DownloadMediaAssets` ownership across `Playlist Service`, `Digital Signage Player`, and `Media Storage`.
4. Decide whether rejection should emit a first-class `ContentRejected` event.
5. Add event names to relevant C4 relationship descriptions if the structural model should be easier for LLMs and humans to correlate.

## Prompt 4

Prompt 4 asked for impact analysis when one C4 container becomes unavailable. The correlation used the same semantic method as the earlier prompts: C4 container names, responsibilities, relationships, and event/data dependencies were compared with DCL capability names, actors, effects, events, outcomes, and lifecycle transitions. No manual mapping file was used.

The analysis treats a capability as unavailable when its primary behavioural path cannot complete. A capability is degraded when an alternative or partial path may still exist, but important effects, events, projections, or downstream consumers are impaired.

| Unavailable C4 container/system | Capabilities unavailable | Capabilities degraded | Outcomes no longer achievable or at risk | External actors affected | Downstream services affected |
| --- | --- | --- | --- | --- | --- |
| `Portal` | `UploadContentBatch`, `ApproveContent` | `ManageMediaItemLifecycle` | `BatchAccepted`, `ContentApprovedForPublishing`, `ContentRejected`; lifecycle cannot progress through approval from the UI. | `ContentUser`, `ContentApprover` | `Content Management Application`, `File Analyser Service`, `Playlist Publisher`, later playlist/player flows starve of new approved content. |
| `Content Management Application` | `UploadContentBatch`, `ApproveContent`; likely `ManageMediaItemLifecycle` if it owns workflow state | `AnalyseMediaFile`, `GenerateThumbnail`, `TranscodeVideo`, `PublishContentToPlaylist` where `UpdateContentReadModel` or content metadata access depends on it | `BatchAccepted`, `ContentApprovedForPublishing`, `ContentRejected`, `MediaLifecycleTracked`; read-model-related effects are at risk. | `ContentUser`, `ContentApprover`; indirectly `DigitalSignagePlayer` through lack of new published content | `Media Storage`, `Event Bus`, `Query Store`, `File Analyser Service`, `Playlist Publisher`. |
| `Media Storage` | `UploadContentBatch`, `AnalyseMediaFile`, `GenerateThumbnail`, `TranscodeVideo`; `ServePlaylistToPlayer` media download path | `ManageMediaItemLifecycle`, `PublishContentToPlaylist` if assets cannot be verified or delivered | `BatchAccepted`, `MediaAnalysed`, `ThumbnailCreated`, `VideoReady`, `PlaylistServed` with assets; lifecycle may reach `Failed`. | `ContentUser`, `ContentApprover`, `DigitalSignagePlayer` | `File Analyser Service`, `Thumbnail Service`, `Video Transcoding Service`, `Playlist Service`, players. |
| `Event Bus` | Event-driven continuation of `AnalyseMediaFile`, `GenerateThumbnail`, `TranscodeVideo`, `PublishContentToPlaylist`; lifecycle event transitions | `UploadContentBatch`, `ApproveContent`, `RecordPlaybackAnalytics` if local persistence succeeds but events cannot propagate | `MediaAnalysed`, `ThumbnailCreated`, `VideoReady`, `PlaylistPublished`, `MediaLifecycleTracked`; emitted events such as `ContentBatchUploaded`, `MediaFileAnalysed`, `ThumbnailGenerated`, `VideoTranscoded`, `PlaylistUpdated`, `ContentPlayed` are not delivered. | All external actors indirectly: uploads may not process; approvers may not see ready content; players may not receive new playlists; analytics audit may be incomplete. | `Event Store`, `File Analyser Service`, `Playlist Publisher`, projection/read-model consumers, analytics/event audit consumers. |
| `Event Store` | No capability necessarily loses its immediate service action, but audit/event-sourced completion is unavailable for event-appending capabilities. | `UploadContentBatch`, `AnalyseMediaFile`, `GenerateThumbnail`, `TranscodeVideo`, `ApproveContent`, `PublishContentToPlaylist`, `RecordPlaybackAnalytics`, `ManageMediaItemLifecycle` | Event-sourced/auditable completion is at risk for `BatchAccepted`, `MediaAnalysed`, `ThumbnailCreated`, `VideoReady`, `ContentApprovedForPublishing`, `PlaylistPublished`, `PlaybackRecorded`; lifecycle reconstruction may be unreliable. | All actors indirectly through loss of durable workflow/event history. | `Query Store` projections, lifecycle/read-model consumers, audit/reporting consumers. |
| `Query Store` | Read-model-dependent serving and publication decisions may be unavailable: `PublishContentToPlaylist`, `ServePlaylistToPlayer` | Upload, analysis, processing, approval can continue but lose `UpdateContentReadModel` effects/projections | `PlaylistPublished`, `PlaylistServed`; read-model visibility for `BatchAccepted`, `MediaAnalysed`, `ThumbnailCreated`, `VideoReady`, and approval outcomes is at risk. | `ContentUser`, `ContentApprover`, `DigitalSignagePlayer` | `Portal`, `Playlist Publisher`, `Playlist Service`. |
| `File Analyser Service` | `AnalyseMediaFile`; downstream video/image processing cannot start | `GenerateThumbnail`, `TranscodeVideo`, `ManageMediaItemLifecycle`, `PublishContentToPlaylist` for newly uploaded items | `MediaAnalysed`; lifecycle cannot move from `Uploaded` to `Analysed` and may reach `Failed` via `AnalysisDeferred`; `ThumbnailCreated` and `VideoReady` are not reached for new uploads. | `ContentUser`, `ContentApprover` indirectly | `Thumbnail Service`, `Video Transcoding Service`, `Playlist Publisher`, downstream playlist/player flows. |
| `Thumbnail Service` | `GenerateThumbnail` | `ManageMediaItemLifecycle`; video/image readiness for approval; `PublishContentToPlaylist` for content requiring thumbnails | `ThumbnailCreated`; lifecycle transition from `Processing` to `ReadyForApproval` via `ThumbnailGenerated`; may reach `Failed` through `ThumbnailDeferred`. | `ContentApprover` indirectly; `DigitalSignagePlayer` may receive stale/no new content | `Media Storage`, `Event Bus`, `Playlist Publisher`. |
| `Video Transcoding Service` | `TranscodeVideo` | `ManageMediaItemLifecycle`; video readiness and publication for video content | `VideoReady`; lifecycle transition from `Processing` to `ReadyForApproval` via `VideoTranscoded`; may reach `Failed` through `TranscodeDeferred`. | `ContentApprover` indirectly; `DigitalSignagePlayer` for video playlists | `Media Storage`, `Event Bus`, `Playlist Publisher`. |
| `Playlist Publisher` | `PublishContentToPlaylist` | `ManageMediaItemLifecycle`, `ServePlaylistToPlayer` for new playlist versions | `PlaylistPublished`; `PlaylistUpdated`; lifecycle cannot move from `Approved` to `Published` for new content and may reach `Failed` via `PlaylistPublicationDeferred`. | `ContentApprover` indirectly; `DigitalSignagePlayer` receives no new approved content | `Playlist Service`, `Event Bus`, `Query Store`. |
| `Playlist Service` | `ServePlaylistToPlayer`; serving side of `PublishContentToPlaylist` | `PublishContentToPlaylist` if playlist versions cannot be published to the serving component | `PlaylistServed`, possibly `PlaylistPublished` if publication requires the service; players cannot poll new versions. | `DigitalSignagePlayer` | `DigitalSignagePlayer`, `Media Storage` asset download flow, `Analytics Service` indirectly because no playback events may be generated for new playlists. |
| `Analytics Service` | `RecordPlaybackAnalytics` | None of the content-processing capabilities directly, but analytics/audit feedback is degraded | `PlaybackRecorded`; `ContentPlayed` ingestion is not persisted by analytics. | `DigitalSignagePlayer` as event sender; business/reporting users indirectly | `Analytics Database`, optional `Event Bus` playback-event append. |
| `Analytics Database` | Persistent analytics count storage for `RecordPlaybackAnalytics` | `RecordPlaybackAnalytics` may receive events but cannot complete durable count persistence | `PlaybackRecorded` is at risk; `AnalyticsWriteDeferred` likely. | `DigitalSignagePlayer` indirectly; analytics consumers not represented in C4/DCL | `Analytics Service`, reporting/analytics consumers. |
| External `Digital Signage Player` | It is not an internal container, but player unavailability prevents `ServePlaylistToPlayer` invocation and `RecordPlaybackAnalytics` event production. | Playlist publication remains possible but cannot be consumed by unavailable players | `PlaylistServed`, `PlaybackRecorded`; `ContentPlayed` events are absent. | Signage viewers and venue/business stakeholders indirectly | `Playlist Service`, `Media Storage`, `Analytics Service`. |

Cross-cutting observations:

- The most central dependency is `Event Bus`. Its failure interrupts the event-driven chain from upload to analysis, processing, publication, lifecycle progression, and analytics/audit propagation.
- `Media Storage` is the hardest data dependency for media processing. Without it, upload, analysis, thumbnail generation, transcoding, and player asset download all fail or become meaningless.
- `Query Store` is primarily a read/projection dependency. Its outage does not necessarily stop every command-side action, but it strongly affects approval visibility, playlist publishing decisions, and playlist serving.
- `ManageMediaItemLifecycle` is impacted by almost every processing/publishing outage because it is a behavioural lifecycle over events and outcomes from other capabilities rather than a standalone implementation component.
- The player-facing path depends on three separate concerns: `Playlist Service` for playlist metadata, `Media Storage` for assets, and `Analytics Service`/`Analytics Database` for playback telemetry.

## Prompt 5

Prompt 5 asked how the `PublishContentToPlaylist` behavioural capability is realised by the C4 architecture. The explanation below correlates the models using names, responsibilities, effects, events, policies, dependencies, and relationships only. No manual mapping file was used.

### Capability Summary

`PublishContentToPlaylist` represents the business behaviour that takes approved content and makes it available through one or more playlist versions. In DCL, the capability is invoked by `ContentProcessingAgent` with a `ContentIntent` containing a `contentId`.

The capability has two outcomes:

- `PlaylistPublished`
- `PlaylistPublicationDeferred`

Its behavioural path is:

1. `PublishPlaylistVersion`
2. `AppendContentEvent` after `PublishPlaylistVersion`
3. `UpdateContentReadModel` after `AppendContentEvent`
4. emit `PlaylistUpdated`

If `PublishPlaylistVersion` is unresolved, the capability produces `PlaylistPublicationDeferred`; otherwise it produces `PlaylistPublished`.

### Participating C4 Containers

| C4 container | Role in realising `PublishContentToPlaylist` | Evidence |
| --- | --- | --- |
| `Playlist Publisher` | Primary structural realiser. It accepts approved content, uses attributes/tags, finds or updates playlists, publishes update events, and publishes playlist versions. | C4 responsibility: "Accepts approved content and uses attributes/tags to add content to matching playlists." Relationships to `Query Store`, `Event Bus`, and `Playlist Service`. |
| `Query Store` | Provides content attributes, tags, and existing playlist projections needed to decide whether to find, create, or update a playlist. | C4 relationship: `Playlist Publisher -> Query Store` reads content attributes and existing playlist projections. DCL effect: `UpdateContentReadModel`. |
| `Playlist Service` | Receives/serves the new playlist version after publication. | C4 relationship: `Playlist Publisher -> Playlist Service` publishes new playlist versions. DCL effect: `PublishPlaylistVersion`. |
| `Event Bus` | Publishes `PlaylistUpdated` and participates in event-driven notification. | C4 relationship: `Playlist Publisher -> Event Bus` publishes playlist update events. DCL event: `PlaylistUpdated`; DCL effect: `AppendContentEvent`. |
| `Event Store` | Durable event-sourcing/audit backing for appended content/workflow events. | C4 relationship: `Event Bus -> Event Store` appends content and workflow events. DCL effect: `AppendContentEvent`; policy: `EventSourcedAudit`. |
| `Content Management Application` | Upstream owner of approval/content workflow and read model context; not the primary publisher but important context provider. | C4 says it handles content commands, metadata, approval workflow, CQRS, and event sourcing. It is upstream of `ContentApproved` and content read models consumed by publisher flows. |

### Events and Lifecycle

The DCL capability emits `PlaylistUpdated`, which aligns with the C4 `Playlist Publisher -> Event Bus` relationship that publishes playlist update events.

`PublishContentToPlaylist` also drives the media item lifecycle:

- `Approved -> Published` on event `PlaylistUpdated`
- `Approved -> Failed` on outcome `PlaylistPublicationDeferred`

This means playlist publication is not only an integration step; it is the behavioural milestone that marks approved content as published.

### Effects and Structural Interpretation

| DCL effect | Structural interpretation |
| --- | --- |
| `PublishPlaylistVersion` | Implemented primarily by `Playlist Publisher` publishing a new version to `Playlist Service`. |
| `AppendContentEvent` | Implemented through event publication/append via `Event Bus` and durable event history in `Event Store`. |
| `UpdateContentReadModel` | Implemented through projection/read-model updates represented by `Query Store`; the exact projection owner is implicit in the C4 model. |

### Policies

`PublishContentToPlaylist` has two DCL policy applications:

- `ContentProcessingReliability governs effect PublishPlaylistVersion`
- `EventSourcedAudit governs effect AppendContentEvent`

Architecturally, this means playlist publication should be retryable/idempotent and event append should be auditable/evidence-bearing. C4 does not model these policies directly; that is an intentional split where DCL carries behavioural constraints and C4 carries structural shape.

### Dependencies

The capability depends on:

- approved content being available from the approval workflow
- content attributes/tags being readable from `Query Store`
- existing playlist projections being available from `Query Store`
- `Playlist Service` being available to receive/serve new playlist versions
- `Event Bus` and `Event Store` being available for publication/audit
- projection/read-model update mechanisms being available after the event append

Downstream, `ServePlaylistToPlayer` depends on the result: players can only receive the new playlist version once `PlaylistUpdated`/publication has occurred and `Playlist Service` can serve the version.

### Failure Points

| Failure point | DCL outcome/effect impact | Architectural impact |
| --- | --- | --- |
| `Playlist Publisher` unavailable | `PublishPlaylistVersion` unresolved; `PlaylistPublicationDeferred` | Approved content cannot become published. Lifecycle may move from `Approved` to `Failed`. |
| `Query Store` unavailable or stale | Publication decision may be impossible or wrong | Tags/attributes and existing playlist projections cannot be reliably used. Playlist matching/creation/update may fail or produce stale results. |
| `Playlist Service` unavailable | `PublishPlaylistVersion` unresolved or incomplete | New playlist version cannot be made available to players. |
| `Event Bus` unavailable | `PlaylistUpdated` cannot be propagated; `AppendContentEvent` may fail | Downstream lifecycle/read-model consumers may not observe publication. |
| `Event Store` unavailable | `AppendContentEvent` loses durable audit/event-sourcing backing | Publication may happen structurally but lack reliable event history/evidence. |
| Projection/read-model update fails | `UpdateContentReadModel` incomplete | Portal, playlist publisher, or playlist service may see stale state. |

### Assessment

`PublishContentToPlaylist` is strongly represented in both models. C4 provides a clear primary realiser (`Playlist Publisher`) and the necessary supporting containers (`Query Store`, `Event Bus`, `Event Store`, `Playlist Service`). DCL adds behavioural precision by naming the capability, outcome, effects, event, policies, and lifecycle consequences.

The main ambiguity is ownership of read-model projection. DCL explicitly says the read model is updated after the content event, while C4 shows `Query Store` as a dependency but does not explicitly name the component responsible for projection updates. This does not block correlation, but it is a useful architectural follow-up.
