context SharedSecurity {
  actor Operator is human

  private shape SecretReviewInput {
    reviewId: Text required
  }
}

context Reviews {
  depends on SharedSecurity

  capability OpenSecretReview {
    intent SecretReviewInput from Operator
    outcome ReviewOpened
    when {
      otherwise then ReviewOpened
    }
  }
}
