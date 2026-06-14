actor Buyer is human
actor InventorySystem is system

effect LockStock is persist
effect ReleaseStock is persist

policy InventoryReliability {
  family reliability
  retry {
    attempts 4
    backoff exponential
  }
  idempotency required
}

shape ReservationInput {
  reservationId: Text required
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
    contributors {
      ReserveStock
    }

    begin Requested

    step Requested {
      kind active
    }

    step Held {
      kind waiting
      waits for outcome StockReserved from ReserveStock
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
