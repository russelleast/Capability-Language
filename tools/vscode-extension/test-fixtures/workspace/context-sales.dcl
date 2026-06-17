language dcl 0.9

context Sales {
  depends on Shared

  effect PersistOrder is persistence

  capability AcceptOrder {
    intent SharedOrderInput from Customer

    outcomes {
      OrderAccepted
      OrderDeferred
    }

    effect PersistOrder

    when {
      PersistOrder unresolved then OrderDeferred
      otherwise then OrderAccepted
    }
  }
}
