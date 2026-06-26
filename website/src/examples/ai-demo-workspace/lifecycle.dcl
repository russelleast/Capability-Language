language dcl 1.0

context AIDemo.OrderFulfilment {
  capability CoordinateFulfilment {
    intent OrderRequestInput from FulfilmentAgent

    outcome FulfilmentStarted

    policies {
      FulfilmentAudit governs lifecycle
    }

    observe {
      lifecycle transitions
      event OrderConfirmedEvent count as ai_demo_orders_confirmed
      event ShipmentPreparedEvent count as ai_demo_shipments_prepared
    }

    when {
      always FulfilmentStarted
    }

    supervises lifecycle AssistedOrderFulfilment {
      identity orderId

      contributors {
        ReviewOrderRequest
        ConfirmOrder
        PrepareShipment
      }

      begin Requested

      step Reviewed waits for event OrderApprovedEvent from ReviewOrderRequest

      step Confirmed waits for event OrderConfirmedEvent from ConfirmOrder

      step Packed waits for event ShipmentPreparedEvent from PrepareShipment

      end ReadyForDispatch
      end NeedsAttention

      move Requested to Reviewed
        on event OrderApprovedEvent from ReviewOrderRequest

      move Reviewed to Confirmed
        on event OrderConfirmedEvent from ConfirmOrder

      move Confirmed to Packed
        on event ShipmentPreparedEvent from PrepareShipment

      move Packed to ReadyForDispatch
        on outcome ShipmentPrepared from PrepareShipment

      move Requested to NeedsAttention
        on outcome NeedsHumanReview from ReviewOrderRequest

      move Requested to NeedsAttention
        on outcome ReviewUnavailable from ReviewOrderRequest

      move Reviewed to NeedsAttention
        on outcome PaymentDeclined from ConfirmOrder

      move Reviewed to NeedsAttention
        on outcome StockUnavailable from ConfirmOrder

      move Confirmed to NeedsAttention
        on outcome ShipmentBlocked from PrepareShipment
    }
  }
}
