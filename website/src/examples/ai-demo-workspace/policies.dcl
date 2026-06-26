language dcl 1.0

context AIDemo.OrderFulfilment {
  policy AgentDecisionConfidence {
    confidence {
      threshold 0.82
    }
  }

  policy FulfilmentReliability {
    reliability {
      retry {
        attempts 3
        backoff exponential
      }
      idempotency required
      timeout 5 minutes
    }
  }

  policy FulfilmentAudit {
    governance {
      audit required
      evidence required
      retention 7 years
    }
  }
}
