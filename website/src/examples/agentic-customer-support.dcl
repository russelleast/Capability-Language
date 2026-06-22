language dcl 0.10

actor Customer is human
actor SupportAgent is agent
actor CRMSystem is external_system

shape CustomerQuestion {
  customerId: Uuid required
  question: Text required
}

shape AnswerDraft {
  customerId: Uuid required
  answer: Text required
  confidence: Number required
}

shape EscalationRequest {
  customerId: Uuid required
  reason: Text required
}

shape KnowledgeSearchResult {
  summary: Text required
  source: Text required
}

effect SearchKnowledgeBase is tool
effect CheckCustomerAccount is tool
effect CreateSupportTicket is invocation
effect NotifyHumanSupport is notification

event CustomerQuestionAnswered is AnswerDraft
event SupportQuestionEscalated is EscalationRequest

policy MinimumAnswerConfidence {
  family confidence
  threshold 0.8
}

policy SafeToolRetry {
  family reliability
  retry {
    attempts 2
    backoff exponential
  }
  idempotency required
}

policy AuditSupportAnswer {
  family governance
  audit required
  evidence required
}

capability AnswerCustomerQuestion {
  intent CustomerQuestion from SupportAgent

  outcomes {
    AnswerPrepared is AnswerDraft
    Escalated
    InsufficientConfidence
    ToolUnavailable
  }

  effects {
    SearchKnowledgeBase
    CheckCustomerAccount after SearchKnowledgeBase
  }

  events {
    emits CustomerQuestionAnswered
  }

  policies {
    MinimumAnswerConfidence governs outcome AnswerPrepared
    SafeToolRetry governs effect SearchKnowledgeBase
    AuditSupportAnswer governs outcome AnswerPrepared
  }

  when {
    SearchKnowledgeBase failed then ToolUnavailable
    CheckCustomerAccount failed then Escalated
    policy MinimumAnswerConfidence fails then InsufficientConfidence
    otherwise then AnswerPrepared
  }

  lifecycle {
    begin Received
    step Investigating
    step Answered
    step Escalated
    end Resolved

    move Received to Investigating on outcome AnswerPrepared
    move Investigating to Answered on event CustomerQuestionAnswered
    move Investigating to Escalated on outcome Escalated
    move Answered to Resolved on event CustomerQuestionAnswered
    move Escalated to Resolved on event SupportQuestionEscalated
  }
}

capability EscalateSupportQuestion {
  intent EscalationRequest from SupportAgent

  outcomes {
    EscalationCreated
    EscalationRejected
  }

  effects {
    CreateSupportTicket
    NotifyHumanSupport after CreateSupportTicket
  }

  events {
    emits SupportQuestionEscalated
  }

  policies {
    SafeToolRetry governs effect CreateSupportTicket
  }

  when {
    CreateSupportTicket failed then EscalationRejected
    otherwise then EscalationCreated
  }
}
