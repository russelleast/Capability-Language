import type * as Monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import { sitePath } from "./links";

export const DCL_LANGUAGE_ID = "dcl";

type DclConceptKind = "core construct" | "section" | "lifecycle keyword";

type DclConceptHelp = {
  label: string;
  kind: DclConceptKind;
  explanation: string;
  reference?: string;
};

type DclSnippet = {
  label: string;
  detail: string;
  documentation: string;
  insertText: string;
};

export const dclConceptHelp: DclConceptHelp[] = [
  {
    label: "context",
    kind: "core construct",
    explanation:
      "A context is a semantic ownership boundary. It groups declarations into an area of architectural responsibility and controls explicit dependencies.",
    reference: "/docs/#context",
  },
  {
    label: "depends on",
    kind: "section",
    explanation:
      "A context dependency makes declarations from another context visible. Dependencies are explicit and are not transitive.",
    reference: "/docs/#context",
  },
  {
    label: "actor",
    kind: "core construct",
    explanation:
      "An actor is an initiating or participating party, such as a human, external system, internal system, automated agent, or scheduled agent.",
    reference: "/docs/#actor",
  },
  {
    label: "shape",
    kind: "core construct",
    explanation:
      "A shape defines reusable structured data with typed fields. Shapes are used by capability intent inputs, event payloads, and outcome payloads.",
    reference: "/docs/#shape",
  },
  {
    label: "capability",
    kind: "core construct",
    explanation:
      "A capability is the unit of business responsibility. It accepts intent, evaluates rules, produces outcomes, and may cause effects, emit events, or progress lifecycle.",
    reference: "/docs/#capability",
  },
  {
    label: "input",
    kind: "section",
    explanation:
      "input refers to the accepted intent shape inside a capability. Rules commonly read fields such as input.email or input.quantity.",
    reference: "/docs/#intent",
  },
  {
    label: "intents",
    kind: "section",
    explanation:
      "Intents describe transport-agnostic requests accepted by a capability, including the input shape and actor source.",
    reference: "/docs/#intent",
  },
  {
    label: "outcomes",
    kind: "section",
    explanation:
      "Outcomes are finite named result classes produced by capability evaluation. They can drive lifecycle transitions, observations, and policies.",
    reference: "/docs/#outcome",
  },
  {
    label: "outcome",
    kind: "core construct",
    explanation:
      "An outcome is one named result class produced by a capability, such as accepted, rejected, deferred, expired, or completed.",
    reference: "/docs/#outcome",
  },
  {
    label: "rules",
    kind: "section",
    explanation:
      "Rules are named invariants or business conditions. They become meaningful when used by outcome causation in a when block.",
    reference: "/docs/#rule",
  },
  {
    label: "effects",
    kind: "section",
    explanation:
      "Effects are externally meaningful actions caused by a capability. An effects block can declare multiple effects and ordering.",
    reference: "/docs/#effect",
  },
  {
    label: "effect",
    kind: "core construct",
    explanation:
      "An effect declares an externally meaningful action caused by a capability, such as persistence, notification, or invocation.",
    reference: "/docs/#effect",
  },
  {
    label: "emits",
    kind: "section",
    explanation:
      "emits declares that a capability can emit a named event. It records semantic event ownership, not broker or transport details.",
    reference: "/docs/#event",
  },
  {
    label: "event",
    kind: "core construct",
    explanation:
      "An event is a named signal with optional structured payload. Capabilities can emit events, and lifecycles can wait for or move on events.",
    reference: "/docs/#event",
  },
  {
    label: "policies",
    kind: "section",
    explanation:
      "A policies block attaches declared policies to semantic boundaries such as capabilities, effects, events, outcomes, or lifecycle steps.",
    reference: "/docs/#policy",
  },
  {
    label: "policy",
    kind: "core construct",
    explanation:
      "A policy expresses a portable execution quality, such as reliability, security, performance, compliance, or governance.",
    reference: "/docs/#policy",
  },
  {
    label: "when",
    kind: "section",
    explanation:
      "A when block declares explicit outcome causation. It connects rule violations, unresolved effects, unconditional branches, and fallbacks to outcomes.",
    reference: "/docs/#when",
  },
  {
    label: "otherwise",
    kind: "section",
    explanation:
      "otherwise is the fallback branch in a when block. It must come after more specific causation branches.",
    reference: "/docs/#when",
  },
  {
    label: "lifecycle",
    kind: "core construct",
    explanation:
      "A lifecycle describes business progression over time with a begin step, ordinary steps, terminal end states, and explicit moves.",
    reference: "/docs/#lifecycle",
  },
  {
    label: "begin",
    kind: "lifecycle keyword",
    explanation:
      "begin names the starting step for a lifecycle.",
    reference: "/docs/#lifecycle",
  },
  {
    label: "step",
    kind: "lifecycle keyword",
    explanation:
      "step declares a lifecycle state. Steps can wait for events or outcomes, require decisions, and define deadlines.",
    reference: "/docs/#lifecycle",
  },
  {
    label: "end",
    kind: "lifecycle keyword",
    explanation:
      "end declares a terminal lifecycle state.",
    reference: "/docs/#lifecycle",
  },
  {
    label: "move",
    kind: "lifecycle keyword",
    explanation:
      "move declares a lifecycle transition from one step to another, caused by an outcome or event.",
    reference: "/docs/#lifecycle",
  },
];

const conceptHelpByLabel = new Map(dclConceptHelp.map((concept) => [concept.label, concept]));

export const dclKeywords = [
  "capability",
  "context",
  "actor",
  "shape",
  "intent",
  "input",
  "outcome",
  "outcomes",
  "intents",
  "rule",
  "rules",
  "effect",
  "effects",
  "event",
  "events",
  "policy",
  "policies",
  "lifecycle",
  "begin",
  "step",
  "end",
  "move",
  "from",
  "to",
  "on",
  "when",
  "otherwise",
  "emits",
  "depends",
  "public",
  "private",
  "export",
  "always",
  "then",
  "after",
  "violated",
  "unresolved",
  "required",
  "family",
  "is",
];

const keywordCompletions = [
  "context",
  "depends on",
  "actor",
  "shape",
  "capability",
  "input",
  "intent",
  "intents",
  "outcome",
  "outcomes",
  "rule",
  "rules",
  "effect",
  "effects",
  "event",
  "events",
  "emits",
  "policy",
  "policies",
  "when",
  "otherwise",
  "lifecycle",
  "begin",
  "step",
  "end",
  "move",
  "from",
  "to",
  "on",
];

const typeCompletions = ["Text", "Boolean", "Number", "Date", "DateTime", "List<T>", "Email", "Uuid", "Money"];
const actorKindCompletions = ["human", "external_system", "internal_system", "automated_agent", "scheduled_agent"];
const effectKindCompletions = ["persistence", "notification", "invocation"];
const triggerCharacters = [" ", "\n", ...Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")];

export const dclSnippets: DclSnippet[] = [
  {
    label: "actor",
    detail: "DCL actor declaration",
    documentation:
      "Declares a named actor and its classification. Actors can provide capability intent or appear in lifecycle decision steps.",
    insertText: "actor ${1:Customer} is ${2|human,external_system,internal_system,automated_agent,scheduled_agent|}",
  },
  {
    label: "shape",
    detail: "DCL shape declaration",
    documentation:
      "Declares a reusable input or payload shape with typed fields. Use required when the field must be present.",
    insertText: "shape ${1:InputName} {\n  ${2:name}: ${3:Text} required\n}",
  },
  {
    label: "capability",
    detail: "DCL capability with intent, outcomes, and causation",
    documentation:
      "Creates a minimal valid capability: one intent, one outcome, and a fallback when branch that causes the outcome.",
    insertText:
      "capability ${1:CapabilityName} {\n  intent ${2:InputShape} from ${3:Actor}\n\n  outcome ${4:Accepted}\n\n  when {\n    otherwise then ${4:Accepted}\n  }\n}",
  },
  {
    label: "rule",
    detail: "DCL rules block",
    documentation:
      "Adds a rules block inside a capability. Rules are named business conditions that can later cause outcomes when violated.",
    insertText: "rules {\n  ${1:RuleName}: ${2:input.value is present}\n}",
  },
  {
    label: "effect",
    detail: "DCL effect declaration",
    documentation:
      "Declares an externally meaningful action. Current validated examples use persistence, notification, and invocation.",
    insertText: "effect ${1:PersistSomething} is ${2|persistence,notification,invocation|}",
  },
  {
    label: "policy",
    detail: "DCL policy declaration",
    documentation:
      "Declares a portable execution policy. Attach it inside a capability with a policies block such as PolicyName governs capability.",
    insertText:
      "policy ${1:ReliableExecution} {\n  family ${2|reliability,availability,scalability,performance,security,compliance,governance,data_protection|}\n}",
  },
  {
    label: "lifecycle",
    detail: "DCL lifecycle block for use inside a capability",
    documentation:
      "Adds a local lifecycle inside a capability with a begin step, a terminal end state, and an outcome-driven move.",
    insertText:
      "lifecycle {\n  begin ${1:Pending}\n  step ${1:Pending}\n  step ${2:Completed}\n  end ${2:Completed}\n\n  move ${1:Pending} to ${2:Completed}\n    on outcome ${3:Accepted}\n}",
  },
  {
    label: "context",
    detail: "DCL context with dependency",
    documentation:
      "Wraps declarations in an ownership boundary and declares an explicit dependency on another context.",
    insertText: "context ${1:Storefront} {\n  depends on ${2:Ordering}\n}",
  },
];

export const dclEditorHelpSnippetLabels = ["capability", "actor", "shape", "policy", "lifecycle"];

let languageRegistered = false;

export function registerDclLanguage(monaco: typeof Monaco): void {
  if (languageRegistered) return;
  languageRegistered = true;

  monaco.languages.register({ id: DCL_LANGUAGE_ID });
  debug("DCL language registered", { languageId: DCL_LANGUAGE_ID });
  monaco.languages.setLanguageConfiguration(DCL_LANGUAGE_ID, {
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
    indentationRules: {
      increaseIndentPattern: /^.*\{[^}"']*$/,
      decreaseIndentPattern: /^\s*\}/,
    },
  });

  monaco.languages.setMonarchTokensProvider(DCL_LANGUAGE_ID, {
    keywords: dclKeywords,
    tokenizer: {
      root: [
        [/[a-zA-Z_][\w.]*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
        [/[{}()[\]]/, "@brackets"],
        [/\/\/.*$/, "comment"],
        [/#.*$/, "comment"],
        [/"[^"]*"/, "string"],
        [/\d+(?:\.\d+)*/, "number"],
        [/[<>=:]/, "operator"],
      ],
    },
  });

  monaco.languages.registerCompletionItemProvider(DCL_LANGUAGE_ID, {
    triggerCharacters,
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const suggestions = [
        ...keywordCompletions.map((keyword) =>
          completion(monaco, keyword, monaco.languages.CompletionItemKind.Keyword, range, "2"),
        ),
        ...typeCompletions.map((typeName) =>
          completion(monaco, typeName, monaco.languages.CompletionItemKind.TypeParameter, range, "3"),
        ),
        ...actorKindCompletions.map((kind) => completion(monaco, kind, monaco.languages.CompletionItemKind.Value, range, "4")),
        ...effectKindCompletions.map((kind) => completion(monaco, kind, monaco.languages.CompletionItemKind.Value, range, "4")),
        ...dclSnippets.map((snippet) => snippetCompletion(monaco, snippet, range)),
      ];
      debug("DCL completion provider called", {
        word: word.word,
        lineNumber: position.lineNumber,
        column: position.column,
        suggestionCount: suggestions.length,
      });

      return {
        suggestions,
      };
    },
  });

  monaco.languages.registerHoverProvider(DCL_LANGUAGE_ID, {
    provideHover(model, position) {
      const match = conceptAtPosition(model, position);
      if (!match) return null;

      const concept = conceptHelpByLabel.get(match.label);
      if (!concept) return null;

      const reference = concept.reference
        ? `\n\n[Reference: ${concept.label}](${sitePath(concept.reference)})`
        : "";

      return {
        range: match.range,
        contents: [
          {
            value: `**${concept.label}**\n\n${concept.explanation}\n\nKind: ${concept.kind}.${reference}`,
          },
        ],
      };
    },
  });

  monaco.editor.defineTheme("dcl-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "8bd0a3", fontStyle: "bold" },
      { token: "identifier", foreground: "e6f0ea" },
      { token: "comment", foreground: "7f9389", fontStyle: "italic" },
      { token: "string", foreground: "d7ba7d" },
      { token: "number", foreground: "b5cea8" },
      { token: "operator", foreground: "9bd4b0" },
    ],
    colors: {
      "editor.background": "#101714",
      "editor.foreground": "#e6f0ea",
      "editor.lineHighlightBackground": "#17231d",
      "editorCursor.foreground": "#8bd0a3",
      "editorLineNumber.foreground": "#7f9389",
      "editorLineNumber.activeForeground": "#cfe0d4",
    },
  });
}

function debug(message: string, detail?: unknown): void {
  if (import.meta.env.DEV) {
    console.debug(`[DCL playground] ${message}`, detail ?? "");
  }
}

function completion(
  monaco: typeof Monaco,
  label: string,
  kind: Monaco.languages.CompletionItemKind,
  range: Monaco.IRange,
  sortPrefix: string,
): Monaco.languages.CompletionItem {
  const concept = conceptHelpByLabel.get(label);
  return {
    label,
    kind,
    insertText: label,
    detail: concept?.kind,
    documentation: concept
      ? {
          value: `${concept.explanation}${concept.reference ? `\n\n[Reference](${sitePath(concept.reference)})` : ""}`,
        }
      : undefined,
    sortText: `${sortPrefix}_${label}`,
    range,
  };
}

function snippetCompletion(
  monaco: typeof Monaco,
  snippet: DclSnippet,
  range: Monaco.IRange,
): Monaco.languages.CompletionItem {
  return {
    label: snippet.label,
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: snippet.detail,
    documentation: {
      value: snippet.documentation,
    },
    filterText: snippet.label,
    insertText: snippet.insertText,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    sortText: `1_${snippet.label}`,
    range,
  };
}

function conceptAtPosition(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
): { label: string; range: Monaco.IRange } | null {
  const phrase = phraseAtPosition(model, position, "depends on");
  if (phrase) return phrase;

  const word = model.getWordAtPosition(position);
  if (!word) return null;

  const conceptLabel = conceptHelpByLabel.has(word.word)
    ? word.word
    : word.word === "intent"
      ? "intents"
      : word.word === "rule"
        ? "rules"
        : null;

  if (!conceptLabel) return null;

  return {
    label: conceptLabel,
    range: {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    },
  };
}

function phraseAtPosition(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
  phrase: string,
): { label: string; range: Monaco.IRange } | null {
  const line = model.getLineContent(position.lineNumber);
  const phrasePattern = new RegExp(`\\b${phrase.replace(" ", "\\s+")}\\b`, "g");
  let match: RegExpExecArray | null;

  while ((match = phrasePattern.exec(line))) {
    const startColumn = match.index + 1;
    const endColumn = startColumn + match[0].length;
    if (position.column >= startColumn && position.column <= endColumn) {
      return {
        label: phrase,
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn,
          endColumn,
        },
      };
    }
  }

  return null;
}
