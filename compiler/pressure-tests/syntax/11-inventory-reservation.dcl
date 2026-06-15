language dcl 0.9

actor Buyer is human
actor InventorySystem is system

effect LockStock is persistence
effect ReleaseStock is persistence

policy InventoryReliability {
  family reliability
  retry {
    attempts 4
    backoff exponential
  }
  idempotency required
}

shape ReservationInput {
  reservationId: Uuid required
  sku: Text required
  quantity: Number required
}

capability ReserveStock {
  intent ReservationInput from Buyer

  actors {
    requester: Buyer
    stockOwner: InventorySystem
  }

  outcomes {
    StockReserved
    StockReservationRejected
    StockReservationDeferred
    ReservationExpired
  }

  rule QuantityPositive: input.quantity is greater than 0

  effects {
    LockStock
    ReleaseStock after LockStock
  }

  policies {
    InventoryReliability governs capability
    InventoryReliability governs effect LockStock
    InventoryReliability governs lifecycle
  }

  when {
    QuantityPositive violated then StockReservationRejected
    LockStock unresolved then StockReservationDeferred
    otherwise then StockReserved
  }

  lifecycle {
    begin Requested

    step Requested

    step Held waits for outcome StockReserved {
      deadline 30 minutes causing outcome ReservationExpired
    }

    end Confirmed
    end Released
    end Rejected

    move Requested to Held
      on outcome StockReserved

    move Requested to Rejected
      on outcome StockReservationRejected

    move Requested to Released
      on outcome StockReservationDeferred

    move Held to Confirmed
      on outcome StockReserved

    move Held to Released
      on outcome ReservationExpired
  }
}
