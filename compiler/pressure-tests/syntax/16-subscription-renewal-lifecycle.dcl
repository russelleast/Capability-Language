language dcl 0.10

actor Subscriber is human
actor BillingSystem is system

effect ChargeSubscription is persistence
effect SendRenewalNotice is notification

policy RenewalReliability {
  family reliability
  retry {
    attempts 3
    backoff exponential
  }
  idempotency required
  timeout 1 day
}

shape RenewalInput {
  subscriptionId: Uuid required
  accountId: Uuid required
}

event RenewalNoticeSent is {
  subscriptionId: Uuid required
}

capability RenewSubscription {
  intent RenewalInput from Subscriber

  actors {
    subscriber: Subscriber
    billing: BillingSystem
  }

  outcomes {
    RenewalCharged
    RenewalDeclined
    RenewalNoticeDeferred
    RenewalExpired
  }

  effects {
    ChargeSubscription
    SendRenewalNotice after ChargeSubscription
  }

  policies {
    RenewalReliability governs capability
    RenewalReliability governs effect ChargeSubscription
    RenewalReliability governs lifecycle
  }

  events {
    emits RenewalNoticeSent
  }

  observe {
    outcome RenewalCharged count
    outcome RenewalDeclined count
    lifecycle transitions
  }

  when {
    ChargeSubscription unresolved then RenewalDeclined
    SendRenewalNotice unresolved then RenewalNoticeDeferred
    otherwise then RenewalCharged
  }

  lifecycle {
    begin Due

    step Due

    step NoticePending waits for event RenewalNoticeSent {
      deadline 7 days causing outcome RenewalExpired
    }

    end Active
    end Suspended
    end Failed

    move Due to NoticePending
      on outcome RenewalCharged

    move Due to Failed
      on outcome RenewalDeclined

    move Due to Suspended
      on outcome RenewalNoticeDeferred

    move NoticePending to Active
      on event RenewalNoticeSent

    move NoticePending to Suspended
      on outcome RenewalExpired
  }
}
