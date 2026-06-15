language dcl 0.9

actor Customer is human

effect SubmitOrder is invocation

policy OrderSubmissionReliability {
  family reliability
  retry {
    attempts 3
  }
  idempotency required
}

shape OrderSubmissionInput {
  orderId: Uuid required
}

capability SubmitCustomerOrder {
  intent OrderSubmissionInput from Customer

  outcomes {
    OrderSubmitted
    SubmissionDeferred
  }

  effect SubmitOrder

  policies {
    OrderSubmissionReliability governs effect SubmitOrder
  }

  when {
    SubmitOrder unresolved then SubmissionDeferred
    otherwise then OrderSubmitted
  }
}
