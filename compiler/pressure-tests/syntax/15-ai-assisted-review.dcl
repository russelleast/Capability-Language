language dcl 0.10

actor Analyst is human
actor ModelService is system

effect StoreModelRecommendation is persistence
effect NotifyAnalyst is notification

policy ModelReviewSecurity {
  family security
  authentication required
  authorization required
  classification confidential
}

shape ReviewInput {
  reviewId: Uuid required
  subjectId: Uuid required
}

capability GenerateRecommendation {
  intent ReviewInput from ModelService
  outcomes {
    RecommendationGenerated
    RecommendationUnavailable
  }
  effect StoreModelRecommendation
  when {
    StoreModelRecommendation unresolved then RecommendationUnavailable
    otherwise then RecommendationGenerated
  }
}

capability CompleteAnalystReview {
  intent ReviewInput from Analyst
  outcomes {
    ReviewAccepted
    ReviewEscalated
  }
  effect NotifyAnalyst
  when {
    NotifyAnalyst unresolved then ReviewEscalated
    otherwise then ReviewAccepted
  }
}

capability SuperviseAssistedReview {
  intent ReviewInput from Analyst
  outcome ReviewOpened

  policies {
    ModelReviewSecurity governs capability
    ModelReviewSecurity governs lifecycle
  }

  observe {
    lifecycle transitions
  }

  when {
    always ReviewOpened
  }

  supervises lifecycle AssistedReview {
    identity reviewId

    contributors {
      GenerateRecommendation
      CompleteAnalystReview
    }

    begin AwaitingRecommendation

    step AwaitingRecommendation {
      waits for outcome RecommendationGenerated from GenerateRecommendation
      waits for outcome RecommendationUnavailable from GenerateRecommendation
    }

    step AnalystReview requires decision from Analyst

    end Accepted
    end Escalated

    move AwaitingRecommendation to AnalystReview
      on outcome RecommendationGenerated from GenerateRecommendation

    move AwaitingRecommendation to Escalated
      on outcome RecommendationUnavailable from GenerateRecommendation

    move AnalystReview to Accepted
      on outcome ReviewAccepted from CompleteAnalystReview

    move AnalystReview to Escalated
      on outcome ReviewEscalated from CompleteAnalystReview
  }
}
