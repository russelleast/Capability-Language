language dcl 1.0

actor Customer is human

shape OrderInput {
  orderId: Text required
}

event OrderAcceptedEvent is {
  orderId: Text required
}

effect PersistOrder is persistence

policy CheckoutAuthorisation {
  security {
    authorization required
  }
}

capability AcceptOrder {
  intent OrderInput from Customer

  outcomes {
    Accepted
    Rejected
    PersistenceFailed
  }

  rule OrderIdPresent: input.orderId is present

  effect PersistOrder

  events {
    emits OrderAcceptedEvent
  }

  policies {
    CheckoutAuthorisation governs capability
  }

  when {
    OrderIdPresent violated then Rejected
    PersistOrder unresolved then PersistenceFailed
    otherwise then Accepted
  }

  lifecycle {
    begin Pending

    step Pending
    end AcceptedState
    end RejectedState

    move Pending to AcceptedState
      on outcome Accepted

    move Pending to RejectedState
      on outcome Rejected
  }
}
