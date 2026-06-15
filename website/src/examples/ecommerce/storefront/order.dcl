language dcl 0.9

context Ecommerce.Storefront {
  effect ReserveInventory is invocation
  effect ProcessPayment is invocation
  effect PersistOrder is persistence

  event OrderCreated is {
    orderId: Uuid required
    customerId: Uuid required
  }

  capability SubmitOrder {
    intent SubmitOrderInput from Customer

    actors {
      buyer: Customer
      stockOwner: InventorySystem
      processor: PaymentProvider
    }

    outcomes {
      OrderAccepted
      PaymentDeclined
      StockUnavailable
      OrderRejected
    }

    rule ShippingPostalCodePresent: input.shippingPostalCode is present

    effects {
      ReserveInventory
      ProcessPayment after ReserveInventory
      PersistOrder after ProcessPayment
    }

    events {
      emits OrderCreated
    }

    policies {
      CheckoutReliability governs capability
      OrderAudit governs event OrderCreated
    }

    when {
      ShippingPostalCodePresent violated then OrderRejected
      ReserveInventory unresolved then StockUnavailable
      ProcessPayment unresolved then PaymentDeclined
      PersistOrder unresolved then OrderRejected
      otherwise then OrderAccepted
    }
  }
}
