language dcl 0.10

context Ecommerce.Storefront {
  effect StartCheckoutSession is persistence
  effect StorePaymentMethod is persistence
  effect StoreShippingAddress is persistence
  effect StoreBillingAddress is persistence

  capability Checkout {
    intent BasketCheckoutInput from Customer

    outcomes {
      CheckoutStarted
      EmptyBasket
    }

    effect StartCheckoutSession

    when {
      StartCheckoutSession unresolved then EmptyBasket
      otherwise then CheckoutStarted
    }
  }

  capability SelectPaymentMethod {
    intent PaymentMethodInput from Customer

    actors {
      payer: Customer
      processor: PaymentProvider
    }

    outcomes {
      PaymentMethodSelected
      PaymentMethodRejected
    }

    rule PaymentTokenPresent: input.paymentToken is present

    effect StorePaymentMethod

    when {
      PaymentTokenPresent violated then PaymentMethodRejected
      StorePaymentMethod unresolved then PaymentMethodRejected
      otherwise then PaymentMethodSelected
    }
  }

  capability CaptureShippingAddress {
    intent ShippingAddressInput from Customer

    outcomes {
      ShippingAddressCaptured
      InvalidShippingAddress
    }

    rule PostalCodePresent: input.postalCode is present

    effect StoreShippingAddress

    when {
      PostalCodePresent violated then InvalidShippingAddress
      StoreShippingAddress unresolved then InvalidShippingAddress
      otherwise then ShippingAddressCaptured
    }
  }

  capability CaptureBillingAddress {
    intent BillingAddressInput from Customer

    outcomes {
      BillingAddressCaptured
      InvalidBillingAddress
    }

    rule BillingPostalCodePresent: input.postalCode is present

    effect StoreBillingAddress

    when {
      BillingPostalCodePresent violated then InvalidBillingAddress
      StoreBillingAddress unresolved then InvalidBillingAddress
      otherwise then BillingAddressCaptured
    }
  }
}
