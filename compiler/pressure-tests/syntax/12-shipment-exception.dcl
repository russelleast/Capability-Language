actor WarehouseOperator is human
actor CarrierSystem is system

effect BookCarrierPickup is notify
effect RecordShipmentException is persist

policy CarrierAvailability {
  family availability
  degradation allowed
  fallback ShipmentExceptionRaised
  dependency_tolerance allowed
}

shape ShipmentInput {
  shipmentId: Text required
  orderId: Text required
}

event CarrierPickupConfirmed is {
  shipmentId: Text required
}

capability ArrangeShipment {
  intent ShipmentInput from WarehouseOperator

  actors {
    operator: WarehouseOperator
    carrier: CarrierSystem
  }

  outcomes {
    ShipmentArranged
    ShipmentExceptionRaised
    CarrierUnavailable
  }

  effects {
    BookCarrierPickup
    RecordShipmentException after BookCarrierPickup
  }

  policies {
    CarrierAvailability governs capability
    CarrierAvailability governs effect BookCarrierPickup
    CarrierAvailability governs lifecycle
  }

  observe {
    effect BookCarrierPickup count failures as carrier_booking_failures
    lifecycle transitions
  }

  when {
    BookCarrierPickup unresolved then CarrierUnavailable
    RecordShipmentException unresolved then ShipmentExceptionRaised
    otherwise then ShipmentArranged
  }

  lifecycle {
    contributors {
      ArrangeShipment
    }

    begin Booking

    step Booking {
      kind active
    }

    step AwaitingCarrier {
      kind waiting
      waits for event CarrierPickupConfirmed from ArrangeShipment
      deadline 4 hours causing outcome ShipmentExceptionRaised
    }

    end Confirmed
    end Exception

    move Booking to AwaitingCarrier
      on outcome ShipmentArranged

    move Booking to Exception
      on outcome CarrierUnavailable

    move AwaitingCarrier to Confirmed
      on event CarrierPickupConfirmed

    move AwaitingCarrier to Exception
      on outcome ShipmentExceptionRaised
  }
}
