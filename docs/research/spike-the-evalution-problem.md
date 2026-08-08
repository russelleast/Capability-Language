# Spike 01 — The Evaluation Problem

## Purpose

## Historical Context

## The Problem

DCL allows architects to describe capability intent, behavioural contracts and operational policies. It allows compilers to validate semantic correctness and implementations to be generated from that intent.

However, DCL currently provides no way to express how confidence in those declarations should be established.

Architects increasingly need to answer questions that cannot be resolved through compiler validation, runtime execution or generated tests alone. These include behavioural conformance, operational evaluation, regulatory compliance and architectural governance.

The language can describe what a capability should do, but not how confidence in those declarations should be established.

This spike explores whether that gap represents a missing language concept or whether it can be addressed through existing DCL constructs.

## Existing DCL Responsibilities

Before exploring the problem, it is worth reminding ourselves what DCL already provides.

DCL is not simply a modelling language. It already defines the semantic contract of a capability and provides the information required for compilation, analysis, implementation and tooling.

Today DCL is responsible for:

### Describing Capability Intent

- Expressing business responsibilities through capabilities.
- Defining actors, intents and outcomes.
- Declaring business rules and invariants.
- Making side effects, events and lifecycle explicit.

### Describing Operational Behaviour

- Declaring policies such as reliability, security, observability and performance.
- Making operational expectations explicit rather than relying on framework conventions.
- Defining execution behaviour independently of implementation technology.

### Semantic Validation

- Detecting ambiguity and incomplete definitions.
- Validating relationships between language constructs.
- Ensuring the capability definition is semantically coherent.

### Generating Derived Artefacts

- Intermediate Representation (IR)
- Documentation
- Diagrams
- Tests
- Runtime projections
- Tooling support

### Providing a Source of Truth

DCL acts as the authoritative declaration of capability intent.

It describes what a capability is responsible for, how it behaves, and the guarantees it declares, while remaining independent of implementation and deployment.


### Capability Semantics

This is the language's responsibility.

DCL describes:

capabilities
intent
outcomes
invariants
policies
effects
events
lifecycle

In other words:

What does this capability mean?

### Policy

### Runtime

## Questions DCL Cannot Currently Answer

- Can this capability be shown to conform to its declared intent?
- Can this capability demonstrate that its declared policies are actually being honoured?
- Can this capability demonstrate compliance with PCI DSS or SOC 2 obligations?
- Can this capability demonstrate that its quality objectives are being achieved?
- Can this capability explain why confidence in its behaviour is high or low?
- Can this capability declare what evidence is required to establish confidence?
- Can confidence be established before deployment, during testing and in production using the same declarative model?
- Can architectural obligations be expressed independently of implementation technology?


## Existing Approaches

### Conformance

### Evaluation

### Compliance

## Why Existing Approaches Are Insufficient

### Conformance is Too Narrow

### Evaluation is Domain Specific

### Compliance is External

### No Unified Architectural Model

## Examples

### Behavioural Claims

### Operational Claims

### Quality Claims

### Compliance Claims

### Architectural Claims

## Looking for a Common Pattern

### What Is Being Declared?

### What Evidence Exists?

### How Is Confidence Established?

### What Is the Result?

## Candidate Design Directions

### Extend Existing Concepts

### Introduce a New Semantic Concept

### Introduce a New Primitive

### Keep Assurance Outside the Language

## Open Questions

## Success Criteria

## Conclusions

## Next Steps