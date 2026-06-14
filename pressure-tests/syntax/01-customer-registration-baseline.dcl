actor Customer is human

effect PersistRegistration is persist
effect SendVerificationMessage is notify

policy RegistrationReliability {
  family reliability
  retry {
    attempts 3
    backoff exponential
  }
  idempotency required
  timeout 30 seconds
}

shape RegistrationInput {
  email: Text required
  acceptedTerms: Boolean required
}

event VerificationMessageSent is {
  email: Text required
}

capability RegisterCustomer {
  intent RegistrationInput from Customer

  outcomes {
    RegistrationAccepted
    TermsRejected
    VerificationDeferred
  }

  rule TermsAccepted: input.acceptedTerms is true

  effects {
    PersistRegistration
    SendVerificationMessage after PersistRegistration
  }

  policies {
    RegistrationReliability governs capability
    RegistrationReliability governs effect SendVerificationMessage
    RegistrationReliability governs lifecycle
  }

  observe {
    capability duration
    outcome RegistrationAccepted count as customer_registrations_accepted
    effect SendVerificationMessage count failures as verification_send_failures
    lifecycle transitions
  }

  when {
    TermsAccepted violated then TermsRejected
    SendVerificationMessage unresolved then VerificationDeferred
    otherwise then RegistrationAccepted
  }

  lifecycle {
    contributors {
      RegisterCustomer
    }

    begin Pending

    step Pending {
      kind active
    }

    step Registered {
      kind waiting
      waits for event VerificationMessageSent from RegisterCustomer
    }

    end Verified
    end Failed

    move Pending to Registered
      on outcome RegistrationAccepted

    move Registered to Verified
      on event VerificationMessageSent

    move Pending to Failed
      on outcome VerificationDeferred
  }
}
