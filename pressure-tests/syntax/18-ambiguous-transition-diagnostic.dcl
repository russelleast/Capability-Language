actor Operator is human

shape DecisionInput {
  decisionId: Text required
}

capability DecideWork {
  intent DecisionInput from Operator
  outcome Accepted
  when {
    otherwise then Accepted
  }

  lifecycle {
    begin Pending

    step Pending {
      kind decision
    }

    end Approved
    end AcceptedForManualReview

    move Pending to Approved
      on outcome Accepted

    move Pending to AcceptedForManualReview
      on outcome Accepted
  }
}
