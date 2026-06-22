language dcl 0.10

actor Operator is human

shape DecisionInput {
  decisionId: Uuid required
}

capability DecideWork {
  intent DecisionInput from Operator
  outcome Accepted
  when {
    always Accepted
  }

  lifecycle {
    begin Pending

    step Pending requires decision from Operator

    end Approved
    end AcceptedForManualReview

    move Pending to Approved
      on outcome Accepted

    move Pending to AcceptedForManualReview
      on outcome Accepted
  }
}
