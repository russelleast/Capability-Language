language dcl 0.9

actor Customer is human

shape RegistrationInput {
  email: Email required
  acceptedTerms: Boolean required
}

effect PersistRegistration is persistence

capability RegisterCustomer {
  intent RegistrationInput from Customer

  outcomes {
    RegistrationAccepted
    TermsRejected
  }

  rule TermsAccepted: input.acceptedTerms is true

  effect PersistRegistration

  when {
    TermsAccepted violated then TermsRejected
    otherwise then RegistrationAccepted
  }
}
