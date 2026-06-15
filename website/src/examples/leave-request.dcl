language dcl 0.9

actor Employee is human
actor Manager is human

shape LeaveRequestInput {
  employeeId: Uuid required
  daysRequested: Number required
}

capability RequestLeave {
  intent LeaveRequestInput from Employee

  actors {
    requester: Employee
    approver: Manager
  }

  outcomes {
    LeaveRequested
    SelfApprovalRejected
    DurationRejected
  }

  rules {
    ApproverIsDifferent:
      actors.requester is not equal to actors.approver

    DurationWithinLimit:
      input.daysRequested is less than 21
  }

  when {
    ApproverIsDifferent violated then SelfApprovalRejected
    DurationWithinLimit violated then DurationRejected
    otherwise then LeaveRequested
  }
}
