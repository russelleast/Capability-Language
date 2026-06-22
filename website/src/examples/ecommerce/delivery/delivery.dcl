language dcl 1.0

context Ecommerce.Delivery {
  effect RecordDeliveryProof is persistence

  shape DeliveryConfirmationInput {
    orderId: Uuid required
    deliveredAt: DateTime required
    proofOfDelivery: Text
  }

  event PackageDelivered is {
    orderId: Uuid required
  }

  capability DeliverPackage {
    intent DeliveryConfirmationInput from Courier

    outcomes {
      Delivered
      DeliveryFailed
    }

    effect RecordDeliveryProof

    events {
      emits PackageDelivered
    }

    when {
      RecordDeliveryProof unresolved then DeliveryFailed
      otherwise then Delivered
    }
  }
}
