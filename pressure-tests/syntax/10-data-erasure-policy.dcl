actor DataSubject is human
actor PrivacyOfficer is human

effect DeleteCustomerData is persist
effect RecordErasureEvidence is persist

policy ErasureProtection {
  family data_protection
  sensitivity personal
  deletion required
  minimization required
}

policy ErasureGovernance {
  family governance
  audit required
  evidence required
  retention 6 years
}

shape ErasureInput {
  requestId: Text required
  customerId: Text required
}

capability EraseCustomerData {
  intent ErasureInput from DataSubject

  actors {
    subject: DataSubject
    officer: PrivacyOfficer
  }

  outcomes {
    ErasureCompleted
    ErasureDenied
    EvidenceRecordingFailed
  }

  rule OfficerAssigned: actors.officer is present

  effects {
    DeleteCustomerData
    RecordErasureEvidence after DeleteCustomerData
  }

  policies {
    ErasureProtection governs capability
    ErasureGovernance governs effect RecordErasureEvidence
    ErasureGovernance governs outcome ErasureDenied
  }

  observe {
    outcome ErasureCompleted count
    outcome ErasureDenied count
    effect RecordErasureEvidence count failures as erasure_evidence_failures
  }

  when {
    OfficerAssigned violated then ErasureDenied
    RecordErasureEvidence unresolved then EvidenceRecordingFailed
    otherwise then ErasureCompleted
  }
}
