actor Operator is human

shape BatchInput {
  batchId: Text required
}

capability ValidateBatch {
  intent BatchInput from Operator
  outcome BatchValidated
  when {
    otherwise then BatchValidated
  }
}

capability ArchiveBatch {
  intent BatchInput from Operator
  outcome BatchArchived
  when {
    otherwise then BatchArchived
  }
}

capability SuperviseBatch {
  intent BatchInput from Operator
  outcome BatchOpened
  when {
    otherwise then BatchOpened
  }

  supervises lifecycle BatchLifecycle {
    identity batchId

    contributors {
      ValidateBatch
      ArchiveBatch
    }

    begin PendingValidation

    step PendingValidation {
      kind waiting
      waits for outcome BatchValidated from ValidateBatch
    }

    end Validated

    move PendingValidation to Validated
      on outcome BatchValidated from ValidateBatch
  }
}
