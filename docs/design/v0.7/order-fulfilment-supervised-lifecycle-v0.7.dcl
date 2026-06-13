actor Customer is human

shape OrderInput {
  orderId: Text required
}

capability AcceptOrder {
  intent OrderInput from Customer

  outcome OrderAccepted

  when {
    otherwise then OrderAccepted
  }
}

capability AuthorisePayment {
  intent OrderInput from Customer

  outcomes {
    PaymentAuthorised
    PaymentDeclined
  }

  rule PaymentDetailsPresent: input.orderId is present

  when {
    PaymentDetailsPresent violated then PaymentDeclined
    otherwise then PaymentAuthorised
  }
}

capability PickOrder {
  intent OrderInput from Customer

  outcome Picked

  when {
    otherwise then Picked
  }
}

capability DispatchOrder {
  intent OrderInput from Customer

  outcome Dispatched

  when {
    otherwise then Dispatched
  }
}

capability OrderFulfilment {
  intent OrderInput from Customer

  outcome FulfilmentSupervised

  when {
    otherwise then FulfilmentSupervised
  }

  supervises lifecycle FulfilmentLifecycle {
    identity orderId

    begin step Received
    step PaymentPending
    step Picking
    step Dispatching
    end step Completed
    end step Failed

    move Received to PaymentPending
      on outcome OrderAccepted
      from AcceptOrder

    move PaymentPending to Picking
      on outcome PaymentAuthorised
      from AuthorisePayment

    move PaymentPending to Failed
      on outcome PaymentDeclined
      from AuthorisePayment

    move Picking to Dispatching
      on outcome Picked
      from PickOrder

    move Dispatching to Completed
      on outcome Dispatched
      from DispatchOrder
  }
}
