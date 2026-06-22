language dcl 0.10

actor Applicant is human
actor Underwriter is human

effect StoreApplication is persistence
effect NotifyUnderwriter is notification

policy LoanPerformance {
  performance {
    latency p95 under 2s
    budget 10 seconds
  }
}

policy LoanGovernance {
  governance {
    audit required
    approval required
    retention 7 years
  }
}

shape LoanApplicationInput {
  applicationId: Uuid required
  requestedAmount: Number required
}

event UnderwritingDecisionReceived is {
  applicationId: Uuid required
}

capability SubmitLoanApplication {
  intent LoanApplicationInput from Applicant

  actors {
    applicant: Applicant
    underwriter: Underwriter
  }

  outcomes {
    ApplicationSubmitted
    ApplicationRejected
    UnderwritingTimedOut
  }

  rule AmountRequested: input.requestedAmount is greater than 0

  effects {
    StoreApplication
    NotifyUnderwriter after StoreApplication
  }

  policies {
    LoanPerformance governs capability
    LoanGovernance governs lifecycle
  }

  events {
    emits UnderwritingDecisionReceived
  }

  observe {
    lifecycle transitions
    outcome UnderwritingTimedOut count as underwriting_timeouts
  }

  when {
    AmountRequested violated then ApplicationRejected
    otherwise then ApplicationSubmitted
  }

  lifecycle {
    begin Submitted

    step Submitted

    step Underwriting waits for event UnderwritingDecisionReceived {
      deadline 5 days causing outcome UnderwritingTimedOut
    }

    end Approved
    end Rejected
    end Expired

    move Submitted to Underwriting
      on outcome ApplicationSubmitted

    move Submitted to Rejected
      on outcome ApplicationRejected

    move Underwriting to Approved
      on event UnderwritingDecisionReceived

    move Underwriting to Expired
      on outcome UnderwritingTimedOut
  }
}
