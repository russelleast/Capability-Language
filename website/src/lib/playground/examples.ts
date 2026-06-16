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
  "ecommerce-platform",
  "leave-request",
  "payment-processing",
  "supervising-lifecycle",
  "policy-example",
  "reliability-policy",
  "authorisation",
  "observed-capability",
  "effects-and-integrations",
];

const playgroundExampleIds = new Set(preferredOrder);

const descriptions: Record<string, string> = {
  "hello-world": "A minimal capability with one actor, one input shape, and one outcome.",
  "register-customer": "Registration with rules, ordered effects, events, and outcome selection.",
  "ecommerce-platform": "A multi-context e-commerce model composed from the validated website source files.",
  "leave-request": "Actor roles and rules for a simple approval capability.",
  "payment-processing": "A local lifecycle that waits for an event and handles a deadline.",
  "supervising-lifecycle": "A supervising capability that coordinates contributor outcomes and events.",
  "policy-example": "Policy concerns attached to a capability, effect, and event.",
  "reliability-policy": "Reliability policy attached to semantic boundaries such as effects and lifecycle steps.",
  authorisation: "A security policy example for authorization requirements.",
  "observed-capability": "A capability with observation metrics over outcomes and effects.",
  "effects-and-integrations": "Effect declarations and integration-oriented capability behavior.",
};

const titleOverrides: Record<string, string> = {
  "ecommerce-platform": "E-Commerce Platform",
};

const ecommerceModulePaths = [
  "../../examples/ecommerce/storefront/actors.dcl",
  "../../examples/ecommerce/storefront/shapes.dcl",
  "../../examples/ecommerce/storefront/policies.dcl",
  "../../examples/ecommerce/storefront/browse-products.dcl",
  "../../examples/ecommerce/storefront/basket.dcl",
  "../../examples/ecommerce/storefront/checkout.dcl",
  "../../examples/ecommerce/storefront/order.dcl",
  "../../examples/ecommerce/warehouse/actors.dcl",
  "../../examples/ecommerce/warehouse/fulfilment.dcl",
  "../../examples/ecommerce/delivery/actors.dcl",
  "../../examples/ecommerce/delivery/delivery.dcl",
  "../../examples/ecommerce/order-lifecycle.dcl",
];

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
  if (titleOverrides[id]) return titleOverrides[id];

  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sortExamples(a: PlaygroundExample, b: PlaygroundExample): number {
  return preferredOrder.indexOf(a.id) - preferredOrder.indexOf(b.id);
}

function stripLanguageHeader(source: string): string {
  return source.replace(/^language\s+dcl\s+\S+\s*/, "").trim();
}

function combinedEcommerceExample(): PlaygroundExample | undefined {
  const sources = ecommerceModulePaths.map((modulePath) => {
    const source = modules[modulePath];
    if (!source) return undefined;

    return `// Source: ${examplePath(modulePath)}\n${stripLanguageHeader(source)}`;
  });

  if (sources.some((source) => source === undefined)) return undefined;

  return {
    id: "ecommerce-platform",
    title: titleFromId("ecommerce-platform"),
    description: descriptions["ecommerce-platform"],
    path: "website/src/examples/ecommerce/*.dcl",
    source: `language dcl 0.9\n\n${sources.join("\n\n")}\n`,
  };
}

const fileExamples = Object.entries(modules)
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
  .filter((example) => example.id !== "ecommerce-platform");

export const playgroundExamples: PlaygroundExample[] = [
  ...fileExamples,
  ...(combinedEcommerceExample() ? [combinedEcommerceExample() as PlaygroundExample] : []),
].sort(sortExamples);
