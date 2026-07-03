language dcl 1.0

context Media.ContentManagement

actor ContentUser is human
actor ContentApprover is human
actor DigitalSignagePlayer is system
actor ContentProcessingAgent is system

effect StoreUploadedMedia is persistence
effect AppendContentEvent is persistence
effect UpdateContentReadModel is persistence
effect AnalyseUploadedFile is invocation
effect GenerateThumbnailAsset is invocation
effect TranscodeVideoAsset is invocation
effect PublishPlaylistVersion is invocation
effect ServePlaylistVersion is invocation
effect DownloadMediaAssets is invocation
effect PersistPlaybackCount is persistence

policy ContentProcessingReliability {
  reliability {
    retry {
      attempts 3
      backoff exponential
    }
    idempotency required
    timeout 5 minutes
  }
}

policy EventSourcedAudit {
  governance {
    audit required
    evidence required
  }
}

policy PlaylistServingPerformance {
  performance {
    latency p95 under 500ms
    budget 2 seconds
  }
}

shape ContentAttribute {
  name: Text required
  value: Text required
}

shape MediaUploadItem {
  contentId: Uuid required
  filename: Text required
  mediaTypeHint: Text
  attributes: List<ContentAttribute> required
}

shape UploadBatchIntent {
  batchId: Uuid required
  uploadedBy: Uuid required
  items: List<MediaUploadItem> required
}

shape ContentIntent {
  contentId: Uuid required
}

shape ApprovalIntent {
  contentId: Uuid required
  approved: Boolean required
}

shape MediaAnalysisIntent {
  contentId: Uuid required
  filename: Text required
}

shape PlayerPlaylistRequest {
  playerId: Uuid required
  currentPlaylistVersion: Number
}

shape PlaybackEventIntent {
  playerId: Uuid required
  contentId: Uuid required
  playedAt: DateTime required
}

event ContentBatchUploaded is {
  batchId: Uuid required
}

event MediaFileAnalysed is {
  contentId: Uuid required
  detectedMediaType: Text required
}

event ThumbnailGenerated is {
  contentId: Uuid required
}

event VideoTranscoded is {
  contentId: Uuid required
}

event ContentApproved is {
  contentId: Uuid required
}

event PlaylistUpdated is {
  playlistId: Uuid required
  version: Number required
}

event ContentPlayed is {
  playerId: Uuid required
  contentId: Uuid required
  playedAt: DateTime required
}

capability UploadContentBatch {
  intent UploadBatchIntent from ContentUser

  outcomes {
    BatchAccepted
    StorageDeferred
  }

  effects {
    StoreUploadedMedia
    AppendContentEvent after StoreUploadedMedia
    UpdateContentReadModel after AppendContentEvent
  }

  events {
    emits ContentBatchUploaded
  }

  policies {
    ContentProcessingReliability governs effect StoreUploadedMedia
    EventSourcedAudit governs effect AppendContentEvent
  }

  observe {
    capability duration as upload_batch_duration
    outcome BatchAccepted count as content_batches_uploaded
    effect StoreUploadedMedia count failures as upload_storage_failures
    event ContentBatchUploaded count as content_batch_uploaded_events
  }

  when {
    StoreUploadedMedia unresolved then StorageDeferred
    otherwise then BatchAccepted
  }
}

capability AnalyseMediaFile {
  intent MediaAnalysisIntent from ContentProcessingAgent

  outcomes {
    MediaAnalysed
    AnalysisDeferred
  }

  effects {
    AnalyseUploadedFile
    AppendContentEvent after AnalyseUploadedFile
    UpdateContentReadModel after AppendContentEvent
  }

  events {
    emits MediaFileAnalysed
  }

  policies {
    ContentProcessingReliability governs effect AnalyseUploadedFile
    EventSourcedAudit governs effect AppendContentEvent
  }

  observe {
    capability duration as media_analysis_duration
    effect AnalyseUploadedFile count failures as media_analysis_failures
    event MediaFileAnalysed count as media_files_analysed
  }

  when {
    AnalyseUploadedFile unresolved then AnalysisDeferred
    otherwise then MediaAnalysed
  }
}

capability GenerateThumbnail {
  intent ContentIntent from ContentProcessingAgent

  outcomes {
    ThumbnailCreated
    ThumbnailDeferred
  }

  effects {
    GenerateThumbnailAsset
    AppendContentEvent after GenerateThumbnailAsset
    UpdateContentReadModel after AppendContentEvent
  }

  events {
    emits ThumbnailGenerated
  }

  policies {
    ContentProcessingReliability governs effect GenerateThumbnailAsset
    EventSourcedAudit governs effect AppendContentEvent
  }

  observe {
    capability duration as thumbnail_generation_duration
    effect GenerateThumbnailAsset count failures as thumbnail_generation_failures
    event ThumbnailGenerated count as thumbnails_generated
  }

  when {
    GenerateThumbnailAsset unresolved then ThumbnailDeferred
    otherwise then ThumbnailCreated
  }
}

capability TranscodeVideo {
  intent ContentIntent from ContentProcessingAgent

  outcomes {
    VideoReady
    TranscodeDeferred
  }

  effects {
    TranscodeVideoAsset
    AppendContentEvent after TranscodeVideoAsset
    UpdateContentReadModel after AppendContentEvent
  }

  events {
    emits VideoTranscoded
  }

  policies {
    ContentProcessingReliability governs effect TranscodeVideoAsset
    EventSourcedAudit governs effect AppendContentEvent
  }

  observe {
    capability duration as video_transcoding_duration
    effect TranscodeVideoAsset count failures as video_transcoding_failures
    event VideoTranscoded count as videos_transcoded
  }

  when {
    TranscodeVideoAsset unresolved then TranscodeDeferred
    otherwise then VideoReady
  }
}

capability ApproveContent {
  intent ApprovalIntent from ContentApprover

  outcomes {
    ContentApprovedForPublishing
    ContentRejected
  }

  rule ApprovalGranted: input.approved is true

  effects {
    AppendContentEvent
    UpdateContentReadModel after AppendContentEvent
  }

  events {
    emits ContentApproved
  }

  policies {
    EventSourcedAudit governs effect AppendContentEvent
  }

  observe {
    outcome ContentApprovedForPublishing count as content_approved
    outcome ContentRejected count as content_rejected
    event ContentApproved count as content_approved_events
  }

  when {
    ApprovalGranted violated then ContentRejected
    otherwise then ContentApprovedForPublishing
  }
}

capability ManageMediaItemLifecycle {
  intent ContentIntent from ContentProcessingAgent

  outcome MediaLifecycleTracked

  policies {
    EventSourcedAudit governs lifecycle
  }

  observe {
    lifecycle transitions
  }

  when {
    always MediaLifecycleTracked
  }

  supervises lifecycle MediaItemLifecycle {
    identity contentId

    contributors {
      AnalyseMediaFile
      GenerateThumbnail
      TranscodeVideo
      ApproveContent
      PublishContentToPlaylist
    }

    begin Uploaded

    step Uploaded waits for event MediaFileAnalysed from AnalyseMediaFile

    step Analysed

    step Processing {
      waits for event ThumbnailGenerated from GenerateThumbnail
      waits for event VideoTranscoded from TranscodeVideo
    }

    step ReadyForApproval requires decision from ContentApprover

    step Approved

    end Published
    end Rejected
    end Failed

    move Uploaded to Analysed
      on event MediaFileAnalysed from AnalyseMediaFile

    move Analysed to Processing
      on outcome MediaAnalysed from AnalyseMediaFile

    move Uploaded to Failed
      on outcome AnalysisDeferred from AnalyseMediaFile

    move Processing to ReadyForApproval
      on event ThumbnailGenerated from GenerateThumbnail

    move Processing to ReadyForApproval
      on event VideoTranscoded from TranscodeVideo

    move Processing to Failed
      on outcome ThumbnailDeferred from GenerateThumbnail

    move Processing to Failed
      on outcome TranscodeDeferred from TranscodeVideo

    move ReadyForApproval to Approved
      on outcome ContentApprovedForPublishing from ApproveContent

    move ReadyForApproval to Rejected
      on outcome ContentRejected from ApproveContent

    move Approved to Published
      on event PlaylistUpdated from PublishContentToPlaylist

    move Approved to Failed
      on outcome PlaylistPublicationDeferred from PublishContentToPlaylist
  }
}

capability PublishContentToPlaylist {
  intent ContentIntent from ContentProcessingAgent

  outcomes {
    PlaylistPublished
    PlaylistPublicationDeferred
  }

  effects {
    PublishPlaylistVersion
    AppendContentEvent after PublishPlaylistVersion
    UpdateContentReadModel after AppendContentEvent
  }

  events {
    emits PlaylistUpdated
  }

  policies {
    ContentProcessingReliability governs effect PublishPlaylistVersion
    EventSourcedAudit governs effect AppendContentEvent
  }

  observe {
    capability duration as playlist_publication_duration
    outcome PlaylistPublished count as playlist_publications
    event PlaylistUpdated count as playlist_updated_events
  }

  when {
    PublishPlaylistVersion unresolved then PlaylistPublicationDeferred
    otherwise then PlaylistPublished
  }
}

capability ServePlaylistToPlayer {
  intent PlayerPlaylistRequest from DigitalSignagePlayer

  outcomes {
    PlaylistServed
    PlaylistUnavailable
  }

  effects {
    ServePlaylistVersion
    DownloadMediaAssets after ServePlaylistVersion
  }

  policies {
    PlaylistServingPerformance governs effect ServePlaylistVersion
  }

  observe {
    capability duration as playlist_serving_duration
    effect ServePlaylistVersion count failures as playlist_serving_failures
  }

  when {
    ServePlaylistVersion unresolved then PlaylistUnavailable
    otherwise then PlaylistServed
  }
}

capability RecordPlaybackAnalytics {
  intent PlaybackEventIntent from DigitalSignagePlayer

  outcomes {
    PlaybackRecorded
    AnalyticsWriteDeferred
  }

  effects {
    PersistPlaybackCount
    AppendContentEvent after PersistPlaybackCount
  }

  events {
    emits ContentPlayed
  }

  policies {
    ContentProcessingReliability governs effect PersistPlaybackCount
    EventSourcedAudit governs event ContentPlayed
  }

  observe {
    outcome PlaybackRecorded count as playback_events_recorded
    effect PersistPlaybackCount count failures as playback_analytics_failures
    event ContentPlayed count as content_played_events
  }

  when {
    PersistPlaybackCount unresolved then AnalyticsWriteDeferred
    otherwise then PlaybackRecorded
  }
}
