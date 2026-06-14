actor Customer is human
actor WarehouseOperator is human

effect ReserveStockRecord is persist
effect CapturePaymentRecord is persist
effect DispatchParcel is notify

policy FulfilmentReliability {
  family reliability
  retry {
    attempts 3
    backoff exponential
  }
  idempotency required
  timeout 2 hours
}

shape OrderInput {
  orderId: Text required
  sku: Text required
  quantity: Number required
}

shape PickInput {
  orderId: Text required
}

event ParcelDispatched is {
  orderId: Text required
}

capability ReserveInventory {
  intent OrderInput from Customer
  outcomes {
    InventoryReserved
    InventoryUnavailable
  }
  effect ReserveStockRecord
  when {
    ReserveStockRecord unresolved then InventoryUnavailable
    otherwise then InventoryReserved
  }
}

capability CapturePayment {
  intent OrderInput from Customer
  outcomes {
    PaymentCaptured
    PaymentDeclined
  }
  effect CapturePaymentRecord
  when {
    CapturePaymentRecord unresolved then PaymentDeclined
    otherwise then PaymentCaptured
  }
}

capability ShipOrder {
  intent PickInput from WarehouseOperator
  outcomes {
    ShipmentStarted
    ShipmentBlocked
  }
  effect DispatchParcel
  when {
    DispatchParcel unresolved then ShipmentBlocked
    otherwise then ShipmentStarted
  }
}

capability FulfilOrder {
  intent OrderInput from Customer
  outcome FulfilmentOpened

  policies {
    FulfilmentReliability governs lifecycle
  }

  observe {
    lifecycle transitions
  }

  when {
    otherwise then FulfilmentOpened
  }

  supervises lifecycle OrderFulfilment {
    identity orderId

    contributors {
      ReserveInventory
      CapturePayment
      ShipOrder
    }

    begin Created

    step Created {
      kind active
    }

    step AwaitingPayment {
      kind waiting
      waits for outcome PaymentCaptured from CapturePayment
      waits for outcome PaymentDeclined from CapturePayment
    }

    step ReadyToShip {
      kind decision
    }

    step Dispatching {
      kind waiting
      waits for event ParcelDispatched from ShipOrder
    }

    end Completed
    end Failed

    move Created to AwaitingPayment
      on outcome InventoryReserved from ReserveInventory

    move Created to Failed
      on outcome InventoryUnavailable from ReserveInventory

    move AwaitingPayment to ReadyToShip
      on outcome PaymentCaptured from CapturePayment

    move AwaitingPayment to Failed
      on outcome PaymentDeclined from CapturePayment

    move ReadyToShip to Dispatching
      on outcome ShipmentStarted from ShipOrder

    move Dispatching to Completed
      on event ParcelDispatched from ShipOrder

    move ReadyToShip to Failed
      on outcome ShipmentBlocked from ShipOrder
  }
}
