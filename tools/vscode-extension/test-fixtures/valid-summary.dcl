language dcl 1.0

actor Operator is human

shape BatchInput {
  batchId: Uuid required
}

event BatchArchived is {
  batchId: Uuid required
}

effect PersistBatch is persistence

policy BatchReliability {
  reliability {
    idempotency required
  }
}

capability ArchiveBatch {
  intent BatchInput from Operator

  outcomes {
    ArchiveRequested
    ArchiveFailed
  }

  effect PersistBatch

  events {
    emits BatchArchived
  }

  policies {
    BatchReliability governs capability
  }

  when {
    PersistBatch unresolved then ArchiveFailed
    otherwise then ArchiveRequested
  }

  lifecycle {
    begin Requested

    step Requested

    end Archived
    end Failed

    move Requested to Archived
      on outcome ArchiveRequested

    move Requested to Failed
      on outcome ArchiveFailed
  }
}
