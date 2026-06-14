actor Customer is human

shape PaymentInput {
  orderId: Text required
  amount: Number required
}

event PaymentReceived is {
  orderId: Text required
}

capability CollectPayment {
  intent PaymentInput from Customer

  outcomes {
    PaymentRequested
    PaymentExpired
  }

  when {
    otherwise then PaymentRequested
  }

  lifecycle {
    contributors {
      CollectPayment
    }

    begin AwaitingPayment

    step AwaitingPayment {
      kind waiting
      waits for event PaymentReceived from CollectPayment
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
