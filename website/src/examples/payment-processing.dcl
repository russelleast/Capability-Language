language dcl 0.9

actor Customer is human

shape PaymentInput {
  orderId: Uuid required
  amount: Money required
}

event PaymentReceived is {
  orderId: Uuid required
}

capability CollectPayment {
  intent PaymentInput from Customer

  outcomes {
    PaymentRequested
    PaymentExpired
  }

  when {
    always then PaymentRequested
  }

  events {
    emits PaymentReceived
  }

  lifecycle {
    begin AwaitingPayment

    step AwaitingPayment waits for event PaymentReceived {
      deadline 15 minutes causing outcome PaymentExpired
    }

    end Paid
    end Expired

    move AwaitingPayment to Paid
      on event PaymentReceived

    move AwaitingPayment to Expired
      on outcome PaymentExpired
  }
}
