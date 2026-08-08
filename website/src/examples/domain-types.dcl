language dcl 1.1

measure Items
measure Weight
measure Days

shape Product {
  stock: Integer
  price: Number
}

shape RetryConfiguration {
  attempts: Integer min 0 max 10 default 3
  delaySeconds: Number min 0 max 60 default 1.5
}

shape Address {
  line1: Text required
  city: Text required
  postcode: Text required
}

shape Customer {
  name: Text required
  address: Address required
}

shape Currency enum {
  GBP
  USD
  EUR
}

shape HexColour {
  value: Text required
}

shape Colour enum {
  Red
  Green
  Blue
  Hex is HexColour
}

shape CardDetails {
  token: Text required
}

shape BankAccount {
  accountNumber: Text required
}

shape PaymentMethod enum {
  Cash
  Card is CardDetails
  BankTransfer is BankAccount
}

shape SearchValue enum {
  TextValue is Text
  NumericValue is Integer
}

shape Failure {
  name: Text
  reason: Text required
  code: Number
}

shape Result enum {
  Success
  Failed is List<Failure>
}

shape DeliveryMethod enum {
  Collection
  HomeDelivery is Address
}

shape OrderLine {
  productId: Text required
  quantity: Integer<Items> min 1 required
  unitWeight: Number<Weight> min 0 required
}

shape Order {
  lines: List<OrderLine> required
  payment: PaymentMethod required
  delivery: DeliveryMethod required
}

shape RetentionPolicy {
  retention: Integer<Days> min 1 required
}
