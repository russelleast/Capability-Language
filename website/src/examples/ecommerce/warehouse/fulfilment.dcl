language dcl 0.9

context Ecommerce.Warehouse {
  effect RecordPick is persistence
  effect CreateParcel is persistence

  shape FulfilmentOrderInput {
    orderId: Uuid required
  }

  event OrderPickedEvent is {
    orderId: Uuid required
  }

  event PackageReadyForDelivery is {
    orderId: Uuid required
  }

  capability PickOrder {
    intent FulfilmentOrderInput from WarehouseOperator

    outcomes {
      OrderPicked
      ItemMissing
    }

    effect RecordPick

    events {
      emits OrderPickedEvent
    }

    when {
      RecordPick unresolved then ItemMissing
      otherwise then OrderPicked
    }
  }

  capability PackageOrder {
    intent FulfilmentOrderInput from WarehouseOperator

    outcomes {
      OrderPackaged
      PackagingFailed
    }

    effect CreateParcel

    events {
      emits PackageReadyForDelivery
    }

    when {
      CreateParcel unresolved then PackagingFailed
      otherwise then OrderPackaged
    }
  }
}
