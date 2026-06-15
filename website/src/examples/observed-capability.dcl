language dcl 0.9

actor Operator is human

effect PersistCase is persistence
effect NotifyCaseOwner is notification

shape CaseInput {
  caseId: Uuid required
  ownerEmail: Email required
}

event CaseOpened is {
  caseId: Uuid required
}

capability OpenSupportCase {
  intent CaseInput from Operator

  outcomes {
    CaseOpenedAccepted
    NotificationDeferred
  }

  effects {
    PersistCase
    NotifyCaseOwner after PersistCase
  }

  events {
    emits CaseOpened
  }

  observe {
    capability duration as support_case_duration
    outcome CaseOpenedAccepted count as support_cases_opened
    effect NotifyCaseOwner count failures as case_owner_notification_failures
    event CaseOpened count as case_opened_events
  }

  when {
    NotifyCaseOwner unresolved then NotificationDeferred
    otherwise then CaseOpenedAccepted
  }
}
