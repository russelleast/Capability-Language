language dcl 0.9

context Ecommerce.Coordination {
  depends on Ecommerce.Storefront
  depends on Ecommerce.Warehouse
  depends on Ecommerce.Delivery

  capability ManageOrderFulfilment {
    intent FulfilmentOrderInput from Customer

    outcome OrderLifecycleOpened

    policies {
      OrderAudit governs lifecycle
    }

    observe {
      lifecycle transitions
      event OrderCreated count as ecommerce_orders_created
      event PackageDelivered count as ecommerce_packages_delivered
    }

    when {
      always then OrderLifecycleOpened
    }

    supervises lifecycle OrderFulfilment {
      identity orderId

      contributors {
        SubmitOrder
        PickOrder
        PackageOrder
        DeliverPackage
      }

      begin Submitted

      step Submitted waits for event OrderCreated from SubmitOrder

      step Picking waits for event OrderPickedEvent from PickOrder

      step Packaging waits for event PackageReadyForDelivery from PackageOrder

      step OutForDelivery waits for event PackageDelivered from DeliverPackage

      end Delivered
      end Failed

      move Submitted to Picking
        on event OrderCreated from SubmitOrder

      move Picking to Packaging
        on event OrderPickedEvent from PickOrder

      move Packaging to OutForDelivery
        on event PackageReadyForDelivery from PackageOrder

      move OutForDelivery to Delivered
        on event PackageDelivered from DeliverPackage

      move Picking to Failed
        on outcome ItemMissing from PickOrder

      move Packaging to Failed
        on outcome PackagingFailed from PackageOrder

      move OutForDelivery to Failed
        on outcome DeliveryFailed from DeliverPackage
    }
  }
}
