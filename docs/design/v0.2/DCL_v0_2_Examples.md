# DCL v0.2 Examples

## Hello World

```dcl
actor User is human

shape HelloInput {
  name: Text required
}

shape GreetingResult {
  message: Text required
}

capability SayHello {
  intent HelloInput from User

  outcomes {
    Greeted is GreetingResult
    MissingName
  }

  rule NamePresent: input.name is present

  when {
    NamePresent violated then MissingName
    otherwise then Greeted
  }
}
```

## Register Customer

```dcl
actor Customer is human

effect SaveRegistration is persist
effect SendVerification is notify

policy SafeRetry is retry

shape RegisterCustomerInput {
  email: Email required
  acceptedTerms: Boolean required
}

event CustomerRegistered is {
  customerId: CustomerId required
  email: Email required
}

capability RegisterCustomer {
  intent RegisterCustomerInput from Customer

  outcomes {
    Accepted
    TermsNotAccepted
    VerificationDeferred
  }

  rules {
    TermsAccepted:
      input.acceptedTerms is true
  }

  effects {
    SaveRegistration
    SendVerification after SaveRegistration
  }

  policies {
    SafeRetry governs SendVerification
  }

  when {
    TermsAccepted violated then TermsNotAccepted
    SendVerification unresolved then VerificationDeferred
    otherwise then Accepted
  }

  lifecycle {
    begin step Pending
    step Verified
    end step Rejected

    move Pending to Verified on event CustomerRegistered
    move Pending to Rejected on outcome VerificationDeferred
  }
}
```

## Request Leave

```dcl
actor Employee is human
actor Manager is human

shape LeaveRequestInput {
  startDate: Date required
  endDate: Date required
}

capability RequestLeave {
  intent LeaveRequestInput from Employee

  actors {
    requester: Employee
    approver: Manager
  }

  outcome Requested
  outcomes {
    InvalidDates
    SelfApprovalAttempt
  }

  rules {
    DatesValid:
      input.startDate is less than input.endDate
      or input.startDate is equal to input.endDate

    SelfApprovalNotAllowed:
      actors.requester is not equal to actors.approver
  }

  when {
    DatesValid violated then InvalidDates
    SelfApprovalNotAllowed violated then SelfApprovalAttempt
    otherwise then Requested
  }
}
```
