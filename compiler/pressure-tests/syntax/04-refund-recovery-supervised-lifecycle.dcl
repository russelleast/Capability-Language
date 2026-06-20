language dcl 0.9

actor Customer is human
actor SupportAgent is human
actor test is system

effect CapturePaymentRecord is persistence
effect RefundPaymentRecord is persistence

policy PaymentRecoveryPolicy {
  family reliability
  retry {
    attempts 2
    backoff linear
  }
  idempotency required
  compensation RefundPayment
}

shape PaymentInput {
  paymentId: Uuid required
  amount: Number required
}

capability CapturePayment {
  intent PaymentInput from Customer
  outcomes {
    PaymentCaptured
    CaptureFailed
  }
  effect CapturePaymentRecord
  when {
    CapturePaymentRecord unresolved then CaptureFailed
    otherwise then PaymentCaptured
  }
}

capability RefundPayment {
  intent PaymentInput from SupportAgent
  outcomes {
    RefundCompleted
    RefundFailed
  }
  effect RefundPaymentRecord
  when {
    RefundPaymentRecord unresolved then RefundFailed
    otherwise then RefundCompleted
  }
}

capability SettlePayment {
  intent PaymentInput from Customer
  outcome SettlementOpened

  policies {
    PaymentRecoveryPolicy governs lifecycle
  }

  when {
    always then SettlementOpened
  }

  supervises lifecycle PaymentSettlement {
    identity paymentId

    contributors {
      CapturePayment
      RefundPayment
    }

    begin Capturing

    step Capturing

    step Recovering {
      recovery RefundPayment
    }

    end Settled
    end Failed

    move Capturing to Settled
      on outcome PaymentCaptured from CapturePayment

    move Capturing to Recovering
      on outcome CaptureFailed from CapturePayment

    move Recovering to Failed
      on outcome RefundFailed from RefundPayment

    move Recovering to Failed
      on outcome RefundCompleted from RefundPayment
  }
}
