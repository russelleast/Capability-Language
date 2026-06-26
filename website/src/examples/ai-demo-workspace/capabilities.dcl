language dcl 1.0

context AIDemo.OrderFulfilment {
  effect CheckCustomerHistory is tool
  effect ScoreFulfilmentRisk is tool
  effect ReserveStock is invocation
  effect AuthorisePayment is invocation
  effect PersistOrder is persistence
  effect AllocateCarrier is invocation
  effect CreateShipmentRecord is persistence

  capability ReviewOrderRequest {
    intent OrderRequestInput from FulfilmentAgent

    actors {
      reviewer: FulfilmentAgent
      inventory: InventorySystem
    }

    outcomes {
      OrderApproved
      NeedsHumanReview
      ReviewUnavailable
    }

    effects {
      CheckCustomerHistory
      ScoreFulfilmentRisk after CheckCustomerHistory
    }

    events {
      emits OrderApprovedEvent
    }

    policies {
      AgentDecisionConfidence governs outcome OrderApproved
      FulfilmentReliability governs effect CheckCustomerHistory
      FulfilmentAudit governs capability
    }

    when {
      CheckCustomerHistory failed then ReviewUnavailable
      ScoreFulfilmentRisk failed then NeedsHumanReview
      policy AgentDecisionConfidence fails then NeedsHumanReview
      otherwise then OrderApproved
    }
  }

  capability ConfirmOrder {
    intent OrderRequestInput from Customer

    actors {
      buyer: Customer
      stockOwner: InventorySystem
      processor: PaymentProvider
    }

    outcomes {
      OrderConfirmed
      PaymentDeclined
      StockUnavailable
      OrderRejected
    }

    rule ShippingPostalCodePresent: input.shippingPostalCode is present

    effects {
      ReserveStock
      AuthorisePayment after ReserveStock
      PersistOrder after AuthorisePayment
    }

    events {
      emits OrderConfirmedEvent
    }

    policies {
      FulfilmentReliability governs capability
      FulfilmentAudit governs event OrderConfirmedEvent
    }

    when {
      ShippingPostalCodePresent violated then OrderRejected
      ReserveStock unresolved then StockUnavailable
      AuthorisePayment unresolved then PaymentDeclined
      PersistOrder unresolved then OrderRejected
      otherwise then OrderConfirmed
    }
  }

  capability PrepareShipment {
    intent ShipmentInstruction from WarehouseOperator

    actors {
      packer: WarehouseOperator
      carrier: CarrierSystem
    }

    outcomes {
      ShipmentPrepared
      ShipmentBlocked
    }

    effects {
      AllocateCarrier
      CreateShipmentRecord after AllocateCarrier
    }

    events {
      emits ShipmentPreparedEvent
    }

    policies {
      FulfilmentReliability governs effect AllocateCarrier
      FulfilmentAudit governs capability
    }

    when {
      AllocateCarrier unresolved then ShipmentBlocked
      CreateShipmentRecord unresolved then ShipmentBlocked
      otherwise then ShipmentPrepared
    }
  }
}
