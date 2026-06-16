import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";
import type { Diagnostic } from "./compiler";

type MonacoEnvironment = {
  getWorker(): Worker;
};

declare global {
  interface Window {
    MonacoEnvironment?: MonacoEnvironment;
  }
}

export type DclEditorController = {
  getValue(): string;
  setValue(value: string): void;
  setDiagnostics(diagnostics: Diagnostic[]): void;
  layout(): void;
  dispose(): void;
};

const dclKeywords = [
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
];

let languageRegistered = false;

export function createDclEditor(textarea: HTMLTextAreaElement, host: HTMLElement): DclEditorController {
  window.MonacoEnvironment = {
    getWorker() {
      return new EditorWorker();
    },
  };

  registerDclLanguage();

  const editor = monaco.editor.create(host, {
    value: textarea.value,
    language: "dcl",
    theme: "dcl-dark",
    automaticLayout: true,
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    fontSize: 14,
    lineNumbers: "on",
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "on",
  });

  const subscription = editor.onDidChangeModelContent(() => {
    textarea.value = editor.getValue();
  });

  host.hidden = false;
  textarea.hidden = true;

  return {
    getValue() {
      return editor.getValue();
    },
    setValue(value: string) {
      if (editor.getValue() !== value) {
        editor.setValue(value);
      }
      textarea.value = value;
    },
    setDiagnostics(diagnostics: Diagnostic[]) {
      const model = editor.getModel();
      if (!model) return;

      monaco.editor.setModelMarkers(model, "dcl", diagnostics.flatMap(toMonacoMarker));
    },
    layout() {
      editor.layout();
    },
    dispose() {
      const model = editor.getModel();
      if (model) monaco.editor.setModelMarkers(model, "dcl", []);
      subscription.dispose();
      editor.dispose();
    },
  };
}

function toMonacoMarker(diagnostic: Diagnostic): monaco.editor.IMarkerData[] {
  if (!hasEditorLocation(diagnostic)) return [];

  const message = diagnostic.code ? `${diagnostic.code}: ${diagnostic.message}` : diagnostic.message;
  return [
    {
      severity: toMonacoSeverity(diagnostic.severity),
      message,
      code: diagnostic.code,
      startLineNumber: diagnostic.line,
      startColumn: diagnostic.column,
      endLineNumber: diagnostic.line,
      endColumn: diagnostic.column + 1,
    },
  ];
}

function hasEditorLocation(diagnostic: Diagnostic): diagnostic is Diagnostic & { line: number; column: number } {
  return Number.isInteger(diagnostic.line) && diagnostic.line > 0 && Number.isInteger(diagnostic.column) && diagnostic.column > 0;
}

function toMonacoSeverity(severity: Diagnostic["severity"]): monaco.MarkerSeverity {
  switch (severity) {
    case "error":
      return monaco.MarkerSeverity.Error;
    case "warning":
      return monaco.MarkerSeverity.Warning;
    case "info":
      return monaco.MarkerSeverity.Info;
  }
}

function registerDclLanguage() {
  if (languageRegistered) return;
  languageRegistered = true;

  monaco.languages.register({ id: "dcl" });
  monaco.languages.setLanguageConfiguration("dcl", {
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

  monaco.languages.setMonarchTokensProvider("dcl", {
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
