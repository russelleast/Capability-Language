language dcl 1.0

actor Claimant is human
actor Adjuster is human

effect StoreClaim is persistence
effect RecordPayout is persistence

policy ClaimCompliance {
  compliance {
    audit required
    approval required
    evidence required
  }
}

shape ClaimInput {
  claimId: Uuid required
  policyNumber: Text required
  amount: Number required
}

capability ValidateClaim {
  intent ClaimInput from Claimant
  outcomes {
    ClaimValid
    ClaimInvalid
  }
  effect StoreClaim
  when {
    StoreClaim unresolved then ClaimInvalid
    otherwise then ClaimValid
  }
}

capability ApproveClaim {
  intent ClaimInput from Adjuster
  outcomes {
    ClaimApproved
    ClaimRejected
  }
  rule AmountSupported: input.amount is less than 10000
  when {
    AmountSupported violated then ClaimRejected
    otherwise then ClaimApproved
  }
}

capability PayClaim {
  intent ClaimInput from Adjuster
  outcomes {
    ClaimPaid
    PayoutFailed
  }
  effect RecordPayout
  when {
    RecordPayout unresolved then PayoutFailed
    otherwise then ClaimPaid
  }
}

capability AssessClaim {
  intent ClaimInput from Claimant
  outcome ClaimAssessmentOpened

  policies {
    ClaimCompliance governs lifecycle
  }

  observe {
    lifecycle transitions
  }

  when {
    always ClaimAssessmentOpened
  }

  supervises lifecycle ClaimAssessment {
    identity claimId

    contributors {
      ValidateClaim
      ApproveClaim
      PayClaim
    }

    begin Received

    step Received

    step AwaitingApproval requires decision from Adjuster

    step Paying

    end Paid
    end Rejected
    end Failed

    move Received to AwaitingApproval
      on outcome ClaimValid from ValidateClaim

    move Received to Rejected
      on outcome ClaimInvalid from ValidateClaim

    move AwaitingApproval to Paying
      on outcome ClaimApproved from ApproveClaim

    move AwaitingApproval to Rejected
      on outcome ClaimRejected from ApproveClaim

    move Paying to Paid
      on outcome ClaimPaid from PayClaim

    move Paying to Failed
      on outcome PayoutFailed from PayClaim
  }
}
