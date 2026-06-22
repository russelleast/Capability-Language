language dcl 1.0

actor Operator is human

effect PublishInvoice is notification
effect PersistInvoice is persistence

policy InvoiceExecution {
  performance {
    throughput above 100 per minute
  }

  governance {
    audit required
    evidence required
  }

  confidence {
    threshold 0.9
  }
}

policy InvoiceSecurity {
  security {
    authentication required
    authorization required
    encryption required
  }
}

shape InvoiceInput {
  invoiceId: Uuid required
  customerId: Uuid required
}

event InvoicePublished is {
  invoiceId: Uuid required
}

capability PublishCustomerInvoice {
  intent InvoiceInput from Operator

  outcomes {
    InvoiceAccepted
    InvoicePublishDeferred
  }

  effects {
    PersistInvoice
    PublishInvoice after PersistInvoice
  }

  policies {
    InvoiceExecution governs capability
    InvoiceSecurity governs event InvoicePublished
  }

  observe {
    capability duration as invoice_publish_duration
    effect PublishInvoice count failures as invoice_publish_failures
    event InvoicePublished count as invoices_published
    outcome InvoicePublishDeferred count as invoice_publish_deferred
  }

  when {
    PublishInvoice unresolved then InvoicePublishDeferred
    otherwise then InvoiceAccepted
  }
}
