actor Customer is human

effect SendAccountInvite is notify

shape InviteInput {
  email: Text required
}

capability InviteCustomer {
  intent InviteInput from Customer

  outcomes {
    Invited
    InviteSending
    SendInvite
    InviteSentNotificationFailed
  }

  rule EmailPresent: input.email is present

  effect SendAccountInvite

  observe {
    outcome Invited count
    outcome InviteSending count
    outcome SendInvite count
    outcome InviteSentNotificationFailed count
  }

  when {
    EmailPresent violated then SendInvite
    SendAccountInvite unresolved then InviteSentNotificationFailed
    otherwise then Invited
  }

  lifecycle {
    begin InviteSending

    step InviteSending {
      kind active
      deadline 1 minute causing outcome InviteSending
    }

    end Invited
    end Failed

    move InviteSending to Invited
      on outcome Invited

    move InviteSending to Failed
      on outcome InviteSentNotificationFailed

    move InviteSending to Failed
      on outcome SendInvite

    move InviteSending to InviteSending
      on outcome InviteSending
  }
}
