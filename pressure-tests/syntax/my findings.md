# My findings

## contributes includes the parent capability

``` dcl
capability CollectPayment
...
  lifecycle {
    contributors {
      CollectPayment
    }

```

if the lifecycle is part of a capability then its already a contributor, seems like noise.

## policies family

I saw many policies which only have 1 family. could a policy contain more that one family and should a family be declared as a block. 

## effects langauge

given 

``` dcl
effect PublishInvoice is notify
effect PersistInvoice is persist
```

it does not sound natural "is notify" or "is persist", would "is notification" and "is persisted" sound better.

## assignment

given 

``` dcl
shape VerificationInput {
  customerId: Text required
}

event CustomerVerified is {
  customerId: Text required
}
```

events can be assign a declared shape using "is" but when its not an existing shape and declared with "is" its inconsistent with shape.

## when...otherwise

```dcl
when {
    otherwise then VerificationStarted
  }
```

does not read well, may be add  "always results" instead

# Ids

The data types need to include an UUID that can be used as an Id 

# kind active

``` dcl
step Submitted {
      kind active
    }
```

Kind active does not read well, i bit like "kind waiting". need to rethink this.

# link decision with actor

```dcl
  step AwaitingApproval {
      kind decision
    }
```

Looking at the syntax, my first thought is who makes the decision