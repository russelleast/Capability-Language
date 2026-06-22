language dcl 1.0

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
