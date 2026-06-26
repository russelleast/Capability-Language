language dcl 1.0

context AIDemo.OrderFulfilment {
  actor Customer is human
  actor WarehouseOperator is human
  actor FulfilmentAgent is agent
  actor InventorySystem is system
  actor PaymentProvider is system
  actor CarrierSystem is system

  shape OrderRequestInput {
    orderId: Uuid required
    customerId: Uuid required
    shippingPostalCode: Text required
  }

  shape ShipmentInstruction {
    orderId: Uuid required
    carrierCode: Text required
  }

  event OrderApprovedEvent is {
    orderId: Uuid required
  }

  event OrderConfirmedEvent is {
    orderId: Uuid required
  }

  event ShipmentPreparedEvent is {
    orderId: Uuid required
  }
}
