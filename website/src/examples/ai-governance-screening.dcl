language dcl 1.0

actor Applicant is human
actor Recruiter is human
actor ScreeningAssistant is agent

shape JobApplication {
  applicantId: Uuid required
  roleId: Uuid required
  resumeText: Text required
  consentGiven: Boolean required
  applicationComplete: Boolean required
  meetsRoleCriteria: Boolean required
}

shape ScreeningDecision {
  applicantId: Uuid required
  roleId: Uuid required
  decision: Text required
  reason: Text required
}

effect RecordScreeningDecision is persistence
effect NotifyApplicant is notification
effect LogScreeningAuditEvidence is persistence

event ApplicantScreeningRecorded is ScreeningDecision
event ApplicantNotificationSent is {
  applicantId: Uuid required
  decision: Text required
}

policy ScreeningDataProtection {
  data_protection {
    sensitivity personal
    minimization required
    masking required
  }
}

policy ScreeningGovernanceEvidence {
  governance {
    audit required
    evidence required
  }
}

policy MinimumScreeningConfidence {
  confidence {
    threshold 0.82
  }
}

policy HumanOversightRequired {
  governance {
    audit required
    evidence required
  }
}

capability ScreenJobApplication {
  intent JobApplication from ScreeningAssistant

  actors {
    applicant: Applicant
    recruiter: Recruiter
    assistant: ScreeningAssistant
  }

  outcomes {
    InviteToInterview is ScreeningDecision
    Reject is ScreeningDecision
    PendingHumanReview is ScreeningDecision
  }

  rules {
    ConsentRequired:
      input.consentGiven is true

    ApplicationComplete:
      input.applicationComplete is true

    MinimumEligibilityMet:
      input.meetsRoleCriteria is true
  }

  effects {
    RecordScreeningDecision
    NotifyApplicant after RecordScreeningDecision
    LogScreeningAuditEvidence after RecordScreeningDecision
  }

  events {
    emits ApplicantScreeningRecorded
    emits ApplicantNotificationSent
  }

  policies {
    ScreeningDataProtection governs capability
    ScreeningGovernanceEvidence governs effect LogScreeningAuditEvidence
    MinimumScreeningConfidence governs outcome InviteToInterview
    HumanOversightRequired governs outcome PendingHumanReview
  }

  observe {
    capability duration as screening_duration
    outcome PendingHumanReview count as screening_human_review_required
    effect LogScreeningAuditEvidence count failures as screening_audit_logging_failures
    event ApplicantScreeningRecorded count as screening_decisions_recorded
  }

  when {
    ConsentRequired violated then PendingHumanReview
    ApplicationComplete violated then PendingHumanReview
    MinimumEligibilityMet violated then Reject
    RecordScreeningDecision failed then PendingHumanReview
    policy MinimumScreeningConfidence fails then PendingHumanReview
    otherwise then InviteToInterview
  }
}
