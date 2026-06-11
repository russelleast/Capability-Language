# DCL v0.2 Migration Guide

## Status

Explanatory migration notes for rewriting v0.1 source into v0.2 source.

## Overview

DCL v0.2 is a clean syntax break. The v0.2 compiler does not preserve v0.1 syntax compatibility, does not emit deprecation warnings, and does not provide migration modes.

Existing v0.1 source must be rewritten before compiling as v0.2.

## Declaration Updates

Before:

```dcl
actor Customer {
  kind human
}
```

After:

```dcl
actor Customer is human
```

Before:

```dcl
effect SendVerification {
  kind notify
}
```

After:

```dcl
effect SendVerification is notify
```

Before:

```dcl
policy SafeRetry {
  kind retry
}
```

After:

```dcl
policy SafeRetry is retry
```

## Intent Updates

Before:

```dcl
input RegisterCustomerInput from Customer
```

After:

```dcl
intent RegisterCustomerInput from Customer
```

The singular v0.2 form produces an intent named `RegisterCustomerInput`, not a hidden intent named `input`.

## Outcome Updates

Before:

```dcl
outcomes {
  Accepted
}
```

After:

```dcl
outcome Accepted
```

The block form remains valid when multiple outcomes are clearer:

```dcl
outcomes {
  Accepted
  Rejected
}
```

## Rule Updates

Before:

```dcl
rules {
  TermsAccepted:
    input.acceptedTerms is true
}
```

After:

```dcl
rule TermsAccepted: input.acceptedTerms is true
```

The block form remains valid for multiple rules.

## Outcome Causation Updates

Before:

```dcl
when {
  rule TermsAccepted fails => TermsNotAccepted
  effect SendVerification failed => VerificationDeferred
  otherwise => Accepted
}
```

After:

```dcl
when {
  TermsAccepted violated then TermsNotAccepted
  SendVerification unresolved then VerificationDeferred
  otherwise then Accepted
}
```

The compiler infers source kind from the decision word.

## Policy Attachment Updates

Before:

```dcl
policies {
  SafeRetry applies to effect SendVerification
}
```

After:

```dcl
policies {
  SafeRetry governs SendVerification
}
```

## Lifecycle Updates

Before:

```dcl
lifecycle {
  begin Pending
  end Verified
  step Pending
  step Verified
}
```

After:

```dcl
lifecycle {
  begin step Pending
  end step Verified
  step Pending
  step Verified
}
```

## Event Emission

Authored event emission syntax is unresolved in v0.2.

Before:

```dcl
emits {
  Accepted => CustomerRegistered
}
```

After:

No canonical v0.2 replacement exists yet. Keep event declarations if needed, but do not author emission relationships until a later syntax amendment defines them.
