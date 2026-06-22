language dcl 1.0

context Shared {
  actor Customer is human

  shape SharedOrderInput {
    orderId: Uuid required
  }
}
