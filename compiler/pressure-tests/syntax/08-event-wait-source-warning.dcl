actor Customer is human

shape VerificationInput {
  customerId: Text required
}

event CustomerVerified is {
  customerId: Text required
}

capability VerifyCustomer {
  intent VerificationInput from Customer
  outcome VerificationStarted
  when {
    otherwise then VerificationStarted
  }
}

capability OpenVerifiedProfile {
  intent VerificationInput from Customer
  outcome ProfileOpeningStarted

  when {
    otherwise then ProfileOpeningStarted
  }

  supervises lifecycle VerifiedProfileOpening {
    identity customerId

    contributors {
      VerifyCustomer
    }

    begin AwaitingVerification

    step AwaitingVerification {
      kind waiting
      waits for event CustomerVerified from VerifyCustomer
    }

    end Opened

    move AwaitingVerification to Opened
      on event CustomerVerified from VerifyCustomer
  }
}
