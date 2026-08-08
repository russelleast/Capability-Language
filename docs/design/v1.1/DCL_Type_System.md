# DCL Language 1.1 Domain Type System

The features in this document are available since DCL 1.1. Compiler 1.1 also continues to support the DCL Language 1.0 contract.

## Principle

> DCL types encode domain distinctions, not merely storage representation.

Types describe domain meaning. Capabilities remain the unit of behaviour; types do not acquire methods, inheritance, interfaces, or hidden runtime behaviour.

## Built-in types

DCL provides `Text`, `Boolean`, `Integer`, `Number`, `Date`, and `DateTime`, together with the existing convenience value types `Uuid`, `Email`, and `Money`.

`Integer` is a signed integral numeric type and is distinct from `Number`. Fractional Integer constraints and defaults are invalid. The portable language semantics do not prescribe a host-language representation.

## Record shapes

Every record shape declares a reusable named domain type. A field can use a built-in, another shape, an enum shape, a collection, or a measured numeric type.

```dcl
language dcl 1.1

shape Address {
  line1: Text required
  city: Text required
}

shape Customer {
  address: Address required
}
```

## Numeric constraints

`Integer` and `Number` fields, including measured forms, support `min`, `max`, and `default` structural constraints.

```dcl
shape RetryConfiguration {
  attempts: Integer min 0 max 10 default 3
  delaySeconds: Number min 0 max 60 default 1.5
}
```

The compiler checks numeric literals, `min <= max`, default compatibility, and range membership. These constraints describe structural validity, not business invariants; business conditions remain rules.

## Enum shapes

An enum shape is a closed set of named alternatives. Each alternative carries either no value or exactly one value of any valid DCL type. DCL uses `is` to associate the alternative with that type.

```dcl
shape PaymentMethod enum {
  Cash
  Card is CardDetails
  BankTransfer is BankAccount
}

shape ValidationResult enum {
  Valid
  Invalid is List<ValidationFailure>
}
```

Enum shapes are discriminated unions in semantic terms, without object-oriented base types or shared-property requirements. Enums may carry built-ins, records, other enums, collections, or measured numeric values.

## Measures

A measure gives a numeric value lightweight domain meaning.

```dcl
measure Quantity
measure Weight
measure Days

shape OrderLine {
  quantity: Integer<Quantity> min 1 required
  weight: Number<Weight> required
}
```

`Integer<Quantity>`, `Integer<Days>`, and unmeasured `Integer` are distinct types. The same applies to measured and unmeasured `Number`. This version intentionally has no implicit conversions, dimensional algebra, derived units, or SI library.

## Result modelling

Result/Either-style domain models use ordinary enum shapes; `Result` is not a special built-in.

```dcl
shape Failure {
  name: Text
  reason: Text required
  code: Number
}

shape Result enum {
  Success
  Failed is List<Failure>
}
```

Outcomes are not enums. Outcomes remain behavioural primitives produced by capabilities, while enum shapes are reusable domain value types.

## Semantic categories

The compiler and IR distinguish built-ins, measured numerics, record shapes, enum shapes, and collections. The IR retains authored type spellings alongside structured type references, numeric constraints, measures, enum alternatives, and alternative payload types.

## Current boundary

The current expression language does not yet contain typed assignment or arithmetic expressions. Consequently, measure incompatibility is represented in the semantic type model and IR, while expression-site `expected … found …` diagnostics will apply when typed value-flow expressions are introduced. No conversion semantics are implied.
