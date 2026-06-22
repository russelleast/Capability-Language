language dcl 0.10

context Sales {
  depends on Shared

  effect PersistSalesOrder is persistence

  capability AcceptSalesOrder {
    intent SharedOrderInput from Customer

    outcomes {
      SalesOrderAccepted
      SalesOrderDeferred
    }

    effect PersistSalesOrder

    observe {
      event SharedOrderSubmitted count as shared_orders_submitted
      outcome SalesOrderAccepted count as sales_orders_accepted
    }

    when {
      PersistSalesOrder unresolved then SalesOrderDeferred
      otherwise then SalesOrderAccepted
    }
  }
}
