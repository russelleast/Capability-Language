language dcl 0.9

context SharedSecurity {
  actor Operator is human

  private shape SecretReviewInput {
    reviewId: Uuid required
  }
}

context Reviews {
  depends on SharedSecurity

  capability OpenSecretReview {
    intent SecretReviewInput from Operator
    outcome ReviewOpened
    when {
      always then ReviewOpened
    }
  }
}
