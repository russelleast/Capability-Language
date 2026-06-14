# Declarative Capability Language Manifesto

## Overview

This language is a **declarative language for business applications**.

It is designed to express systems in terms of:

- capabilities
- intent
- outcomes
- invariants
- effects
- policies
- guarantees

Rather than:

- endpoints
- services
- controllers
- infrastructure wiring

The goal is to make systems **explicit, analysable, portable, and implementable by both humans and AI**.

---

## 1. Capabilities are the unit of meaning

Software is not a collection of endpoints, services, or classes.

It is a collection of **capabilities**.

A capability defines:

- what can be done  
- under what conditions  
- with what guarantees  
- and with what consequences  

If something cannot be expressed as a capability, it does not belong in the core language.

---

## 2. Intent over transport

The language does not model HTTP, messaging, or RPC.

It models **intent**.

How an intent arrives is a deployment concern.  
What the intent means is a language concern.

---

## 3. Outcomes over responses

The language does not assume immediacy.

Every capability declares its **possible outcomes**:

- success  
- failure  
- partial  
- deferred  

Failure is not an exception.  
It is part of the contract.

---

## 4. Effects are part of the program

If a capability:

- changes state  
- emits an event  
- calls another system  
- triggers a process  

then that is part of its definition.

There are no hidden side effects.

---

## 5. Invariants are first-class

Business rules are not scattered across code.

They are declared as **invariants**:

- always true  
- explicitly enforced  
- statically analyzable where possible  

---

## 6. Policies over ad hoc behavior

Reliability, security, and execution behavior are not implemented repeatedly.

They are declared as **policies**:

- retries  
- timeouts  
- idempotency  
- authorization  
- consistency guarantees  

---

## 7. Time is explicit

The language acknowledges:

- immediate vs deferred execution  
- ordering  
- concurrency  
- eventual consistency  

Time is not an accidental side effect of infrastructure.

---

## 8. Observability is not optional

Every capability is observable by design.

The language defines:

- what should be measured  
- what should be traced  
- what should be audited  

---

## 9. The compiler enforces meaning

The compiler is not just a translator.

It:

- detects ambiguity  
- rejects incomplete definitions  
- verifies contracts  
- checks invariants where possible  
- derives execution models  
- generates artifacts  

---

## 10. Source defines the system

The same source must be sufficient to generate:

- executable systems  
- tests  
- documentation  
- diagrams  
- operational insight  

If something critical exists only outside the source, the language has failed.

---

## 11. No hidden behavior

Nothing important should be implied by:

- naming conventions  
- framework magic  
- runtime defaults  
- invisible middleware  

If behavior matters, it must be declared.

---

## 12. Portable meaning

The meaning of a program must survive across:

- runtimes  
- infrastructures  
- deployment models  

Only execution strategy should change.

---

## 13. Designed for humans and AI

The language must be:

- precise enough for compilers  
- structured enough for AI  
- clear enough for humans  

It must reduce ambiguity, not encode it.

---

## 14. Semantics before syntax

The language defines meaning before representation.

Syntax is not the source of truth.
Semantics are.

A construct is only considered valid when:

its semantic role is unambiguous
its relationships to other constructs are defined
its compiler obligations are explicit
its runtime obligations are explicit

Surface representation must not introduce or hide meaning.

If a concept cannot be described without referring to syntax, it is not yet defined.

---

### Consequences
Names must not carry hidden semantics
Syntax must not imply execution behavior
No meaning may depend on formatting, ordering, or convention
All observable behavior must be derivable from semantic definition

### Design rule

A construct is defined by what must be true about it, not how it is written.

### Anti-patterns

The language must reject:

encoding behavior in naming conventions
relying on positional meaning
introducing constructs before their semantics are clear
using familiar syntax that implies incorrect mental models

### Practical application

Before introducing or modifying any construct, the following must be answered:

What does it mean?
What does it relate to?
What must the compiler prove?
What must the runtime enforce?
What ambiguity does it remove?

If these cannot be answered, the construct is not ready.


## Core Interaction Model

The language models system behavior as:

**Intent → Outcomes (via Capability)**

Where:

- **Intent** = a declared attempt to use a capability  
- **Outcome** = any possible result (success or failure)  
- **Capability** = the unit that evaluates intent and produces outcomes  

This model is:

- transport-agnostic  
- compatible with synchronous and asynchronous execution  
- suitable for long-running and distributed systems  

---

## One-line manifesto

**"Describe what a system is responsible for, what it guarantees, and what it causes — and let execution be derived."**