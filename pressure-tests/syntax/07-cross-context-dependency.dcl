context Shared {
  actor Customer is human

  shape SharedOrderInput {
    orderId: Text required
    customerId: Text required
  }

  event SharedOrderSubmitted is {
    orderId: Text required
  }
}

context Sales {
  depends on Shared

  effect PersistSalesOrder is persist

  policy SalesAuditPolicy {
    family governance
    audit required
    retention 7 years
  }

  capability AcceptSalesOrder {
    intent SharedOrderInput from Customer

    outcomes {
      SalesOrderAccepted
      SalesOrderDeferred
    }

    effect PersistSalesOrder

    policies {
      SalesAuditPolicy governs capability
      SalesAuditPolicy governs event SharedOrderSubmitted
    }

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
