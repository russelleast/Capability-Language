language dcl 0.10

context Ecommerce.Storefront {
  policy CheckoutReliability {
    family reliability
    retry {
      attempts 3
      backoff exponential
    }
    idempotency required
    timeout 5 minutes
  }

  policy OrderAudit {
    family governance
    audit required
    retention 7 years
  }
}
