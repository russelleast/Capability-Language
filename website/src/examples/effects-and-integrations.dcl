language dcl 1.0

actor Customer is human

effect PersistPaymentAttempt is persistence
effect CallPaymentGateway is invocation
effect SendPaymentReceipt is notification

shape PaymentAuthorisationInput {
  paymentId: Uuid required
  amount: Money required
}

event PaymentAuthorised is {
  paymentId: Uuid required
}

capability AuthorisePayment {
  intent PaymentAuthorisationInput from Customer

  outcomes {
    PaymentAuthorised
    PaymentGatewayUnavailable
  }

  effects {
    PersistPaymentAttempt
    CallPaymentGateway after PersistPaymentAttempt
    SendPaymentReceipt after CallPaymentGateway
  }

  events {
    emits PaymentAuthorised
  }

  when {
    CallPaymentGateway unresolved then PaymentGatewayUnavailable
    otherwise then PaymentAuthorised
  }
}
