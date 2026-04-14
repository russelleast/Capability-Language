# Declarative Capability Language — Analysis Passes v0.1

## Overview
Defines compiler analysis passes applied to Capability IR.

---

## Pass Categories

### 1. Reference Resolution
- All symbols resolved
- No undefined references

---

### 2. Completeness
- Capability has intent and outcomes
- All primitives correctly attached

---

### 3. Ambiguity Detection
- Distinguishable outcomes
- Non-conflicting lifecycle transitions
- Clear policy precedence

---

### 4. Lifecycle Validation
- Initial state defined
- Transitions valid
- No unreachable states

---

### 5. Soundness Analysis
- At least one valid execution path
- No dead ends
- All outcomes reachable (where possible)

---

### 6. Policy Analysis
- Valid attachment points
- No conflicting policies
- Parameters valid

---

### 7. Effect Analysis
- Valid ordering
- Idempotency respected
- Retry compatibility

---

### 8. Portability Analysis
- Target compatibility
- Degraded guarantees surfaced

---

## Output

Each pass produces:
- diagnostics (error/warning/info)
- annotations on IR nodes

---

## Summary

Analysis passes are the **compiler brain**, ensuring semantic correctness, clarity, and portability.
