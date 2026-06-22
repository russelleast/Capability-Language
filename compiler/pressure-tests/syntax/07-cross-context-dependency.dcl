language dcl 0.10

context Shared {
  actor Customer is human

  shape SharedOrderInput {
    orderId: Uuid required
    customerId: Uuid required
  }

  event SharedOrderSubmitted is {
    orderId: Uuid required
  }
}

context Sales {
  depends on Shared

  effect PersistSalesOrder is persistence

  policy SalesAuditPolicy {
    governance {
      audit required
      retention 7 years
    }
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
