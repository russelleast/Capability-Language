type RawExampleModule = string;

export type PlaygroundExample = {
  id: string;
  title: string;
  description: string;
  path: string;
  source: string;
};

const modules = import.meta.glob<RawExampleModule>("../../examples/**/*.dcl", {
  eager: true,
  query: "?raw",
  import: "default",
});

const preferredOrder = [
  "hello-world",
  "register-customer",
  "leave-request",
  "payment-processing",
  "supervising-lifecycle",
  "policy-example",
  "authorisation",
  "observed-capability",
  "effects-and-integrations",
];

const playgroundExampleIds = new Set(preferredOrder);

const descriptions: Record<string, string> = {
  "hello-world": "A minimal capability with one actor, one input shape, and one outcome.",
  "register-customer": "Registration with rules, ordered effects, events, and outcome selection.",
  "leave-request": "Actor roles and rules for a simple approval capability.",
  "payment-processing": "A local lifecycle that waits for an event and handles a deadline.",
  "supervising-lifecycle": "A supervising capability that coordinates contributor outcomes and events.",
  "policy-example": "Policy concerns attached to a capability, effect, and event.",
  authorisation: "A security policy example for authorization requirements.",
  "observed-capability": "A capability with observation metrics over outcomes and effects.",
  "effects-and-integrations": "Effect declarations and integration-oriented capability behavior.",
};

function examplePath(modulePath: string): string {
  return modulePath.replace("../../examples/", "website/src/examples/");
}

function exampleId(modulePath: string): string {
  return modulePath
    .replace("../../examples/", "")
    .replace(/\.dcl$/, "")
    .replace(/\//g, "-");
}

function titleFromId(id: string): string {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sortExamples(a: PlaygroundExample, b: PlaygroundExample): number {
  return preferredOrder.indexOf(a.id) - preferredOrder.indexOf(b.id);
}

export const playgroundExamples: PlaygroundExample[] = Object.entries(modules)
  .map(([modulePath, source]) => {
    const id = exampleId(modulePath);

    return {
      id,
      title: titleFromId(id),
      description: descriptions[id] ?? "A validated DCL source file from the website examples.",
      path: examplePath(modulePath),
      source,
    };
  })
  .filter((example) => playgroundExampleIds.has(example.id))
  .sort(sortExamples);
