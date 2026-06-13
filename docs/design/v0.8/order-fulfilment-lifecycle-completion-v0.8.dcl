actor Customer is human

shape OrderInput {
  orderId: Text required
}

event PaymentReceived is OrderInput

capability CheckInventory {
  intent OrderInput from Customer
  outcome InventoryReserved

  when {
    otherwise then InventoryReserved
  }
}

capability CapturePayment {
  intent OrderInput from Customer
  outcome PaymentCaptured

  when {
    otherwise then PaymentCaptured
  }
}

capability ShipOrder {
  intent OrderInput from Customer

  outcomes {
    OrderShipped
    ShippingFailed
  }

  rule ShippingPossible: input.orderId is present

  when {
    ShippingPossible violated then ShippingFailed
    otherwise then OrderShipped
  }
}

capability RefundPayment {
  intent OrderInput from Customer
  outcome RecoveryFailed

  when {
    otherwise then RecoveryFailed
  }
}

capability OrderFulfilment {
  intent OrderInput from Customer

  outcomes {
    FulfilmentSupervised
    PaymentExpired
  }

  when {
    otherwise then FulfilmentSupervised
  }

  supervises lifecycle OrderLifecycle {
    identity orderId

    contributors {
      CheckInventory
      CapturePayment
      ShipOrder
      RefundPayment
    }

    begin Pending

    step Pending {
      kind active
    }

    step AwaitingPayment {
      kind waiting

      # The current compiler validates event existence and contributor declaration.
      # Capability-level event emission ownership is reported as an explicit warning until modeled.
      waits for event PaymentReceived from CapturePayment

      deadline 15 minutes causing outcome PaymentExpired
    }

    step PaymentCaptured {
      kind active

      recovery RefundPayment
    }

    step RecoveringPayment {
      kind recovery
    }

    end Completed
    end Expired
    end Failed

    move Pending to AwaitingPayment
      on outcome InventoryReserved from CheckInventory

    move AwaitingPayment to PaymentCaptured
      on event PaymentReceived

    move AwaitingPayment to Expired
      on outcome PaymentExpired

    move PaymentCaptured to Completed
      on outcome OrderShipped from ShipOrder

    move PaymentCaptured to RecoveringPayment
      on outcome ShippingFailed from ShipOrder

    move RecoveringPayment to Failed
      on outcome RecoveryFailed from RefundPayment
  }
}
