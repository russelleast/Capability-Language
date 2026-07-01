language dcl 1.0

context Media.ContentManagement

actor ContentUser is human
actor ContentApprover is human
actor DigitalSignagePlayer is system
actor ContentPlayback is system

shape UploadBatchInput {
  batchId: Uuid required
  uploadedBy: Uuid required
  items: List<MediaUploadItem> required
}

shape MediaUploadItem {
  contentId: Uuid required
  filename: Text required
  mediaTypeHint: Text
  attributes: List<ContentAttribute> required
}

shape ContentAttribute {
  name: Text required
  value: Text required
}

shape ContentIdInput {
  contentId: Uuid required
}

shape PlayerPlaylistRequest {
  playerId: Uuid required
  currentPlaylistVersion: Number
}

shape PlaybackEventInput {
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

event UnsupportedMediaDetected is {
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
    retry attempts 3
  }

  observability {
    trace required
    metrics required
  }
}

policy EventSourcedAudit {
  governance {
    audit required
    evidence required
  }

  observability {
    trace required
  }
}

policy PlaylistAvailability {
  availability {
    target 99.9 percent
  }

  performance {
    latency below 500 ms
  }
}

capability UploadContentBatch {
  input UploadBatchInput from ContentUser

  outcomes {
    BatchAccepted
    BatchRejected
    StorageFailed
  }

  effects {
    StoreUploadedMedia
    AppendContentEvent after StoreUploadedMedia
    UpdateContentReadModel after AppendContentEvent
  }

  policies {
    EventSourcedAudit
    ContentProcessingReliability applies to effect StoreUploadedMedia
  }

  when {
    effect StoreUploadedMedia failed => StorageFailed
    otherwise => BatchAccepted
  }

  emits {
    BatchAccepted emits ContentBatchUploaded
  }
}

capability AnalyseMediaFile {
  input ContentIdInput from ContentPlayback

  outcomes {
    VideoDetected
    ImageDetected
    AudioDetected
    MicrositeDetected
    UnsupportedMediaType
    AnalysisFailed
  }

  effects {
    AnalyseUploadedFile
    AppendContentEvent after AnalyseUploadedFile
  }

  policies {
    EventSourcedAudit
    ContentProcessingReliability applies to effect AnalyseUploadedFile
  }

  when {
    effect AnalyseUploadedFile failed => AnalysisFailed
    otherwise => VideoDetected
  }

  emits {
    VideoDetected emits MediaFileAnalysed
    ImageDetected emits MediaFileAnalysed
    AudioDetected emits MediaFileAnalysed
    MicrositeDetected emits MediaFileAnalysed
    UnsupportedMediaType emits UnsupportedMediaDetected
  }
}

capability GenerateThumbnail {
  input ContentIdInput from ContentPlayback

  outcomes {
    ThumbnailCreated
    ThumbnailFailed
  }

  effects {
    GenerateThumbnailAsset
    AppendContentEvent after GenerateThumbnailAsset
  }

  policies {
    ContentProcessingReliability applies to effect GenerateThumbnailAsset
    EventSourcedAudit
  }

  when {
    effect GenerateThumbnailAsset failed => ThumbnailFailed
    otherwise => ThumbnailCreated
  }

  emits {
    ThumbnailCreated emits ThumbnailGenerated
  }
}

capability TranscodeVideo {
  input ContentIdInput from ContentPlayback

  outcomes {
    VideoReady
    TranscodeFailed
  }

  effects {
    TranscodeVideoAsset
    AppendContentEvent after TranscodeVideoAsset
  }

  policies {
    ContentProcessingReliability applies to effect TranscodeVideoAsset
    EventSourcedAudit
  }

  when {
    effect TranscodeVideoAsset failed => TranscodeFailed
    otherwise => VideoReady
  }

  emits {
    VideoReady emits VideoTranscoded
  }
}

capability ApproveContent {
  input ContentIdInput from ContentUser

  outcomes {
    Approved
    ApprovalRejected
  }

  effects {
    AppendContentEvent
    UpdateContentReadModel after AppendContentEvent
  }

  policies {
    EventSourcedAudit
  }

  when {
    otherwise => Approved
  }

  emits {
    Approved emits ContentApproved
  }
}

capability PublishContentToPlaylist {
  input ContentIdInput from ContentPlayback

  outcomes {
    PlaylistMatched
    PlaylistCreated
    NoMatchingPlaylist
    PlaylistPublicationFailed
  }

  effects {
    PublishPlaylistVersion
    AppendContentEvent after PublishPlaylistVersion
    UpdateContentReadModel after AppendContentEvent
  }

  policies {
    ContentProcessingReliability applies to effect PublishPlaylistVersion
    EventSourcedAudit
  }

  when {
    effect PublishPlaylistVersion failed => PlaylistPublicationFailed
    otherwise => PlaylistMatched
  }

  emits {
    PlaylistMatched emits PlaylistUpdated
    PlaylistCreated emits PlaylistUpdated
  }
}

capability ServePlaylistToPlayer {
  input PlayerPlaylistRequest from DigitalSignagePlayer

  outcomes {
    NewPlaylistAvailable
    NoPlaylistChange
    PlaylistUnavailable
  }

  effects {
    ServePlaylistVersion
    DownloadMediaAssets after ServePlaylistVersion
  }

  policies {
    PlaylistAvailability
  }

  when {
    effect ServePlaylistVersion failed => PlaylistUnavailable
    otherwise => NewPlaylistAvailable
  }
}

capability RecordPlaybackAnalytics {
  input PlaybackEventInput from DigitalSignagePlayer

  outcomes {
    PlaybackRecorded
    AnalyticsWriteFailed
  }

  effects {
    PersistPlaybackCount
    AppendContentEvent after PersistPlaybackCount
  }

  policies {
    EventSourcedAudit
    ContentProcessingReliability applies effect PersistPlaybackCount
  }

  when {
    effect PersistPlaybackCount failed then AnalyticsWriteFailed
    otherwise then PlaybackRecorded
  }

  emits {
    PlaybackRecorded emits ContentPlayed
  }
}