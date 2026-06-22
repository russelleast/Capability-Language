language dcl 0.10

context Ecommerce.Storefront {
  capability BrowseProducts {
    intent ProductSearch from Customer

    outcomes {
      ProductsReturned
      InvalidSearch
    }

    rule SearchTermPresent: input.query is present

    when {
      SearchTermPresent violated then InvalidSearch
      otherwise then ProductsReturned
    }
  }
}
