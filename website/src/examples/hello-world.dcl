language dcl 0.9

actor User is human

shape GreetingInput {
  name: Text required
}

capability SayHello {
  intent GreetingInput from User

  outcome GreetingPrepared

  when {
    always then GreetingPrepared
  }
}
