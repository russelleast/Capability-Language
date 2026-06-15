language dcl 0.9

actor Operator is human

shape BatchInput {
  batchId: Uuid required
}

capability ValidateBatch {
  intent BatchInput from Operator
  outcome BatchValidated
  when {
    always then BatchValidated
  }
}

capability ArchiveBatch {
  intent BatchInput from Operator
  outcome BatchArchived
  when {
    always then BatchArchived
  }
}

capability SuperviseBatch {
  intent BatchInput from Operator
  outcome BatchOpened
  when {
    always then BatchOpened
  }

  supervises lifecycle BatchLifecycle {
    identity batchId

    contributors {
      ValidateBatch
      ArchiveBatch
    }

    begin PendingValidation

    step PendingValidation waits for outcome BatchValidated from ValidateBatch

    end Validated

    move PendingValidation to Validated
      on outcome BatchValidated from ValidateBatch
  }
}
