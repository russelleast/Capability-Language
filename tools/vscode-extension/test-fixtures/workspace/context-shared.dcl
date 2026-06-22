language dcl 0.10

context Shared {
  actor Customer is human

  shape SharedOrderInput {
    orderId: Uuid required
  }
}
