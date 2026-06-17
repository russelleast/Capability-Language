language dcl 0.9

actor Customer is human

capability BrokenCapability {
  intent MissingInputShape from Customer
  outcome Started

  when {
    always then Started
  }
}
