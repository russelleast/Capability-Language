language dcl 0.10

actor Employee is human
actor Manager is human

policy LeaveAuthorisation {
  family security
  authorization required
}

shape LeaveApprovalInput {
  requestId: Uuid required
  daysRequested: Number required
}

capability ApproveLeaveRequest {
  intent LeaveApprovalInput from Employee

  actors {
    requester: Employee
    approver: Manager
  }

  outcomes {
    ApprovalGranted
    SelfApprovalRejected
  }

  rules {
    ApproverIsDifferent:
      actors.requester is not equal to actors.approver
  }

  policies {
    LeaveAuthorisation governs capability
  }

  when {
    ApproverIsDifferent violated then SelfApprovalRejected
    otherwise then ApprovalGranted
  }
}
