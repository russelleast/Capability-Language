language dcl 0.10

actor Customer is human

capability BrokenCapability {
  intent MissingInputShape from Customer
  outcome Started

  when {
    always Started
  }
}
