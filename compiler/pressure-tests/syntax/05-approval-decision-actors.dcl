language dcl 0.9

actor Employee is human
actor Manager is human
actor FinanceSystem is system

shape ExpenseInput {
  claimId: Uuid required
  amount: Number required
}

capability RequestExpenseApproval {
  intent ExpenseInput from Employee

  actors {
    requester: Employee
    approver: Manager
    payer: FinanceSystem
  }

  outcomes {
    ApprovalRequested
    SelfApprovalRejected
    AmountRejected
  }

  rules {
    ApproverIsDifferent:
      actors.requester is not equal to actors.approver

    AmountWithinLimit:
      input.amount is less than 5000
  }

  observe {
    capability duration
    outcome ApprovalRequested count
    outcome SelfApprovalRejected count as self_approval_rejections
  }

  when {
    ApproverIsDifferent violated then SelfApprovalRejected
    AmountWithinLimit violated then AmountRejected
    otherwise then ApprovalRequested
  }

  lifecycle {
    begin Drafted

    step Drafted requires decision from approver

    step AwaitingManager waits for outcome ApprovalRequested

    end Approved
    end Rejected

    move Drafted to AwaitingManager
      on outcome ApprovalRequested

    move Drafted to Rejected
      on outcome SelfApprovalRejected

    move Drafted to Rejected
      on outcome AmountRejected

    move AwaitingManager to Approved
      on outcome ApprovalRequested
  }
}
