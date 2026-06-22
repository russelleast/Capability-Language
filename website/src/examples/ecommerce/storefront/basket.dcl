language dcl 0.10

context Ecommerce.Storefront {
  effect AddBasketItemRecord is persistence

  capability AddToBasket {
    intent BasketItemInput from Customer

    outcomes {
      ItemAdded
      ProductUnavailable
      InvalidQuantity
    }

    rule QuantityPositive: input.quantity is greater than 0

    effect AddBasketItemRecord

    when {
      QuantityPositive violated then InvalidQuantity
      AddBasketItemRecord unresolved then ProductUnavailable
      otherwise then ItemAdded
    }
  }
}
