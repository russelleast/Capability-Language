language dcl 0.10

actor Customer is human

shape VerificationInput {
  customerId: Uuid required
}

event CustomerVerified is {
  customerId: Uuid required
}

capability VerifyCustomer {
  intent VerificationInput from Customer
  outcome VerificationStarted
  events {
    emits CustomerVerified
  }
  when {
    always VerificationStarted
  }
}

capability OpenVerifiedProfile {
  intent VerificationInput from Customer
  outcome ProfileOpeningStarted

  when {
    always ProfileOpeningStarted
  }

  supervises lifecycle VerifiedProfileOpening {
    identity customerId

    contributors {
      VerifyCustomer
    }

    begin AwaitingVerification

    step AwaitingVerification waits for event CustomerVerified from VerifyCustomer

    end Opened

    move AwaitingVerification to Opened
      on event CustomerVerified from VerifyCustomer
  }
}
