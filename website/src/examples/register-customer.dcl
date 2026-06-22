language dcl 1.0

actor Customer is human

effect PersistRegistration is persistence
effect SendVerificationMessage is notification

shape RegistrationInput {
  email: Email required
  acceptedTerms: Boolean required
}

event VerificationMessageSent is {
  email: Email required
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

  events {
    emits VerificationMessageSent
  }

  when {
    TermsAccepted violated then TermsRejected
    SendVerificationMessage unresolved then VerificationDeferred
    otherwise then RegistrationAccepted
  }
}
