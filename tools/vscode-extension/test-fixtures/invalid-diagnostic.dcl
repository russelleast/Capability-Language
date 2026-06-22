language dcl 1.0

actor Customer is human

capability BrokenCapability {
  intent MissingInputShape from Customer
  outcome Started

  when {
    always Started
  }
}
