workspace "Enterprise Media Content Management System" "C4 model for the C4 + DCL experiment." {

  model {
    contentUser = person "Content User" "Uploads, attributes, reviews, and approves media content."
    contentApprover = person "Content Approver" "Reviews and approves media content for publication."
    signageViewer = person "Signage Viewer" "Views published media on digital signage screens."

    mediaSystem = softwareSystem "Enterprise Media Content Management System" "Manages uploaded media, processing pipelines, playlists generation, digital signage delivery, and analytics." {

      portal = container "Portal" "Allows users to upload media, assign attributes, create playlists, and approve content." "Web Application"

      contentManagementApp = container "Content Management Application" "Handles content commands, metadata, approval workflow, CQRS command handling, and event sourcing." "Application Service"

      fileAnalyser = container "File Analyser Service" "Analyses uploaded files, detects media type, extracts metadata, and routes content into the correct processing pipeline." "Background Service"

      thumbnailService = container "Thumbnail Service" "Generates thumbnails for video and image content." "Background Service"

      videoTranscodingService = container "Video Transcoding Service" "Transcodes video content into playback-ready formats." "Background Service"

      playlistPublisher = container "Playlist Publisher" "Accepts approved content and uses attributes/tags to add content to matching playlists." "Background Service"

      playlistService = container "Playlist Service" "Serves playlist versions to digital signage players." "API / Service"

      analyticsService = container "Analytics Service" "Receives playback events such as ContentPlayed and persists analytics counts." "Service"

      eventStore = container "Event Store" "Stores domain events (event sourcing)." "Event Store" {
        tags "Database"
      }

      queryStore = container "Query Store" "Stores query-optimised read models for portal and playlist access." "SQL Server" {
        tags "Database"
      }

      analyticsDatabase = container "Analytics Database" "Stores playback counts and analytics summaries." "SQL Server" {
        tags "Database"
      }

      mediaStore = container "Media Storage" "Stores uploaded source media, generated thumbnails, transcoded video, and microsite packages." "Object/File Storage" {
        tags "Database"
      }

      eventBus = container "Event Bus" "Publishes and subscribes to domain events for decoupled communication between services." "Message Broker" {
        tags "Database"
      }
    }

    digitalSignagePlayer = softwareSystem "Digital Signage Player" "Remote player that polls for playlist updates, downloads playlists, plays content, and emits playback events."

    contentUser -> portal "Uploads batches of media, assigns attributes"
    contentApprover -> portal "Reviews and approves media content for publication"
    portal -> contentManagementApp "Submits commands and queries content status"
    contentManagementApp -> mediaStore "Stores uploaded media files"
    contentManagementApp -> eventBus "Publishes events"
    contentManagementApp -> queryStore "Updates and reads content read models"

    eventBus -> eventStore "Appends content and workflow events"
    eventBus -> fileAnalyser "Requests media analysis after upload"

    fileAnalyser -> mediaStore "Reads uploaded media"
    fileAnalyser -> eventBus "Publishes media analysis events"

    fileAnalyser -> thumbnailService "Routes image content and video content for thumbnail generation"
    fileAnalyser -> videoTranscodingService "Routes video content for transcoding"

    thumbnailService -> mediaStore "Writes generated thumbnails"
    thumbnailService -> eventBus "Publishes thumbnail generation events"

    videoTranscodingService -> mediaStore "Writes transcoded video renditions"
    videoTranscodingService -> eventBus "Publishes video transcoding events"

    eventBus -> playlistPublisher "Notifies approved content is ready for publication"
    
    playlistPublisher -> queryStore "Reads content attributes and existing playlist projections"
    playlistPublisher -> eventBus "Publishes playlist update events"
    playlistPublisher -> playlistService "Publishes new playlist versions"

    playlistService -> queryStore "Reads playlist versions and player assignments"

    digitalSignagePlayer -> playlistService "Polls for new playlist versions"
    digitalSignagePlayer -> mediaStore "Downloads playlist media assets"
    digitalSignagePlayer -> analyticsService "Pushes ContentPlayed events"

    analyticsService -> analyticsDatabase "Persists playback counts"
    analyticsService -> eventBus "Optionally appends playback events"
  }

  views {
    systemContext mediaSystem "SystemContext" {
      include *
      autoLayout lr
    }

    container mediaSystem "Containers" {
      include *
      autoLayout lr
    }

    styles {
      element "Person" {
        shape person
      }

      element "Database" {
        shape cylinder
      }
    }
  }
}