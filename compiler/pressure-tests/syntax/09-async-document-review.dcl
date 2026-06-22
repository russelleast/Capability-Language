language dcl 0.10

actor Author is human
actor Reviewer is human

effect StoreDocument is persistence
effect SendReviewRequest is notification

policy ReviewQueuePolicy {
  scalability {
    queue allowed
    backpressure delay
    concurrency 5
  }
}

shape DocumentReviewInput {
  documentId: Uuid required
  title: Text required
}

event ReviewCompleted is {
  documentId: Uuid required
}

capability RequestDocumentReview {
  intent DocumentReviewInput from Author

  outcomes {
    ReviewRequested
    ReviewRequestDeferred
    ReviewTimedOut
  }

  effects {
    StoreDocument
    SendReviewRequest after StoreDocument
  }

  policies {
    ReviewQueuePolicy governs capability
    ReviewQueuePolicy governs lifecycle
  }

  events {
    emits ReviewCompleted
  }

  observe {
    capability duration
    lifecycle transitions
    outcome ReviewTimedOut count as document_reviews_timed_out
  }

  when {
    SendReviewRequest unresolved then ReviewRequestDeferred
    otherwise then ReviewRequested
  }

  lifecycle {
    begin Submitted

    step Submitted

    step UnderReview waits for event ReviewCompleted {
      deadline 3 days causing outcome ReviewTimedOut
    }

    end Accepted
    end Expired
    end Deferred

    move Submitted to UnderReview
      on outcome ReviewRequested

    move Submitted to Deferred
      on outcome ReviewRequestDeferred

    move UnderReview to Accepted
      on event ReviewCompleted

    move UnderReview to Expired
      on outcome ReviewTimedOut
  }
}
