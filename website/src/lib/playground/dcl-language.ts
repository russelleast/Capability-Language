import type * as Monaco from "monaco-editor/esm/vs/editor/editor.api.js";

export const DCL_LANGUAGE_ID = "dcl";

export const dclKeywords = [
  "capability",
  "context",
  "actor",
  "shape",
  "intent",
  "input",
  "outcome",
  "outcomes",
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

const snippets = [
  {
    label: "actor",
    detail: "DCL actor declaration",
    insertText: "actor ${1:Customer} is ${2|human,external_system,internal_system,automated_agent,scheduled_agent|}",
  },
  {
    label: "shape",
    detail: "DCL shape declaration",
    insertText: "shape ${1:InputName} {\n  ${2:name}: ${3:Text} required\n}",
  },
  {
    label: "capability",
    detail: "DCL capability with intent, outcomes, and causation",
    insertText:
      "capability ${1:CapabilityName} {\n  intent ${2:InputShape} from ${3:Actor}\n\n  outcome ${4:Accepted}\n\n  when {\n    otherwise then ${4:Accepted}\n  }\n}",
  },
  {
    label: "rule",
    detail: "DCL rules block",
    insertText: "rules {\n  ${1:RuleName}: ${2:input.value is present}\n}",
  },
  {
    label: "effect",
    detail: "DCL effect declaration",
    insertText: "effect ${1:PersistSomething} is ${2|persistence,notification,invocation|}",
  },
  {
    label: "policy",
    detail: "DCL policy declaration",
    insertText:
      "policy ${1:ReliableExecution} {\n  family ${2|reliability,availability,scalability,performance,security,compliance,governance,data_protection|}\n}",
  },
  {
    label: "lifecycle",
    detail: "DCL lifecycle block for use inside a capability",
    insertText:
      "lifecycle {\n  begin ${1:Pending}\n  step ${1:Pending}\n  step ${2:Completed}\n  end ${2:Completed}\n\n  move ${1:Pending} to ${2:Completed}\n    on outcome ${3:Accepted}\n}",
  },
  {
    label: "context",
    detail: "DCL context with dependency",
    insertText: "context ${1:Storefront} {\n  depends on ${2:Ordering}\n}",
  },
];

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
        ...snippets.map((snippet) => snippetCompletion(monaco, snippet, range)),
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
  return {
    label,
    kind,
    insertText: label,
    sortText: `${sortPrefix}_${label}`,
    range,
  };
}

function snippetCompletion(
  monaco: typeof Monaco,
  snippet: { label: string; detail: string; insertText: string },
  range: Monaco.IRange,
): Monaco.languages.CompletionItem {
  return {
    label: snippet.label,
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: snippet.detail,
    filterText: snippet.label,
    insertText: snippet.insertText,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    sortText: `1_${snippet.label}`,
    range,
  };
}
