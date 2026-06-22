language dcl 1.0

context Ecommerce.Storefront {
  policy CheckoutReliability {
    reliability {
      retry {
        attempts 3
        backoff exponential
      }
      idempotency required
      timeout 5 minutes
    }
  }

  policy OrderAudit {
    governance {
      audit required
      retention 7 years
    }
  }
}
