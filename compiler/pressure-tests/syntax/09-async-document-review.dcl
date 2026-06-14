actor Author is human
actor Reviewer is human

effect StoreDocument is persist
effect SendReviewRequest is notify

policy ReviewQueuePolicy {
  family scalability
  queue allowed
  backpressure delay
  concurrency 5
}

shape DocumentReviewInput {
  documentId: Text required
  title: Text required
}

event ReviewCompleted is {
  documentId: Text required
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
    contributors {
      RequestDocumentReview
    }

    begin Submitted

    step Submitted {
      kind active
    }

    step UnderReview {
      kind waiting
      waits for event ReviewCompleted from RequestDocumentReview
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
