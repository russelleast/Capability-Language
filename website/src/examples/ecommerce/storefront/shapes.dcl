language dcl 0.9

context Ecommerce.Storefront {
  shape ProductSearch {
    query: Text required
    category: Text
  }

  shape BasketItemInput {
    basketId: Uuid required
    productId: Uuid required
    quantity: Number required
  }

  shape BasketCheckoutInput {
    basketId: Uuid required
    customerId: Uuid required
  }

  shape PaymentMethodInput {
    basketId: Uuid required
    paymentToken: Text required
  }

  shape ShippingAddressInput {
    basketId: Uuid required
    recipientName: Text required
    line1: Text required
    city: Text required
    postalCode: Text required
    country: Text required
  }

  shape BillingAddressInput {
    basketId: Uuid required
    line1: Text required
    city: Text required
    postalCode: Text required
    country: Text required
  }

  shape SubmitOrderInput {
    orderId: Uuid required
    basketId: Uuid required
    customerId: Uuid required
    paymentToken: Text required
    shippingPostalCode: Text required
  }
}
