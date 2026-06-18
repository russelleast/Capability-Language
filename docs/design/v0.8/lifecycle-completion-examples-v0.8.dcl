language DCL v0.8

actor Customer is human

shape ExampleInput {
  value: Text required
}

capability VerifyCustomer {
  intent ExampleInput from Customer

  outcomes {
    CustomerVerified
    VerificationCancelled
  }

  rule VerificationPossible: input.value is present

  when {
    VerificationPossible violated then VerificationCancelled
    otherwise then CustomerVerified
  }
}

capability CustomerReview {
  intent ExampleInput from Customer
  outcome ReviewOpened

  when {
    otherwise then ReviewOpened
  }

  supervises lifecycle CustomerReviewLifecycle {
    identity value

    contributors {
      VerifyCustomer
    }

    begin step Pending

    step Pending {
      kind waiting
      waits for outcome CustomerVerified from VerifyCustomer
      waits for outcome VerificationCancelled from VerifyCustomer
    }

    end step Verified
    end step Cancelled

    move Pending to Verified
      on outcome CustomerVerified from VerifyCustomer

    move Pending to Cancelled
      on outcome VerificationCancelled from VerifyCustomer
  }
}

capability PaymentDeadlineExample {
  intent ExampleInput from Customer

  outcomes {
    Started
    PaymentExpired
  }

  when {
    otherwise then Started
  }

  lifecycle {
    begin AwaitingPayment

    step AwaitingPayment {
      kind active
      deadline 15 minutes causing outcome PaymentExpired
    }

    end Expired

    move AwaitingPayment to Expired
      on outcome PaymentExpired
  }
}

capability RefundPaymentExample {
  intent ExampleInput from Customer
  outcome RecoveryFailed

  when {
    otherwise then RecoveryFailed
  }
}

capability RecoveryExample {
  intent ExampleInput from Customer
  outcome Captured

  when {
    otherwise then Captured
  }

  supervises lifecycle RecoveryLifecycle {
    identity value

    contributors {
      RefundPaymentExample
    }

    begin Captured

    step Captured {
      kind active
      recovery RefundPaymentExample
    }

    step Recovering {
      kind recovery
    }

    end Failed

    move Captured to Recovering
      on outcome Captured

    move Recovering to Failed
      on outcome RecoveryFailed from RefundPaymentExample
  }
}
