import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/editor/contrib/format/browser/formatActions.js";
import "monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js";
import "monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker.js?worker";
import type { Diagnostic } from "./compiler";
import { DCL_LANGUAGE_ID, registerDclLanguage } from "./dcl-language";
import { formatDcl } from "./formatDcl";

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
  revealSourceLocation(location: SourceLocation): boolean;
  formatSource(): boolean;
  showSuggestions(): void;
  layout(): void;
  dispose(): void;
};

export type SourceLocation = {
  line: number;
  column?: number;
};

const autoSuggestPrefixes = new Set(["cap", "actor", "shape", "policy"]);

export function createDclEditor(textarea: HTMLTextAreaElement, host: HTMLElement): DclEditorController {
  window.MonacoEnvironment = {
    getWorker() {
      return new EditorWorker();
    },
  };

  registerDclLanguage(monaco);

  const editor = monaco.editor.create(host, {
    value: textarea.value,
    language: DCL_LANGUAGE_ID,
    theme: "dcl-dark",
    automaticLayout: true,
    fixedOverflowWidgets: true,
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    fontSize: 14,
    lineNumbers: "on",
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "on",
    quickSuggestions: {
      other: true,
      comments: false,
      strings: false,
    },
    quickSuggestionsDelay: 50,
    suggestOnTriggerCharacters: true,
    tabCompletion: "on",
    wordBasedSuggestions: "off",
    snippetSuggestions: "top",
    suggest: {
      snippetsPreventQuickSuggestions: false,
      showSnippets: true,
    },
  });

  const subscription = editor.onDidChangeModelContent(() => {
    textarea.value = editor.getValue();
    triggerSuggestionsForKnownPrefix(editor);
  });
  let revealDecorationIds: string[] = [];
  let revealHighlightTimer: number | undefined;

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
    revealSourceLocation(location: SourceLocation) {
      const model = editor.getModel();
      if (!model || !hasSourceLocation(location) || location.line > model.getLineCount()) return false;

      const column = Math.min(Math.max(location.column ?? 1, 1), model.getLineMaxColumn(location.line));
      const range = new monaco.Range(location.line, column, location.line, model.getLineMaxColumn(location.line));

      editor.focus();
      editor.setPosition({ lineNumber: location.line, column });
      editor.revealLineInCenter(location.line);

      revealDecorationIds = editor.deltaDecorations(revealDecorationIds, [
        {
          range,
          options: {
            isWholeLine: true,
            className: "dcl-source-reveal-line",
            overviewRuler: {
              color: "rgba(143, 191, 157, 0.75)",
              position: monaco.editor.OverviewRulerLane.Center,
            },
          },
        },
      ]);

      if (revealHighlightTimer) window.clearTimeout(revealHighlightTimer);
      revealHighlightTimer = window.setTimeout(() => {
        revealDecorationIds = editor.deltaDecorations(revealDecorationIds, []);
        revealHighlightTimer = undefined;
      }, 1800);

      return true;
    },
    formatSource() {
      const model = editor.getModel();
      if (!model) return false;

      const current = model.getValue();
      const formatted = formatDcl(current);
      if (formatted === current) return false;

      editor.pushUndoStop();
      editor.executeEdits("dcl-format", [
        {
          range: model.getFullModelRange(),
          text: formatted,
          forceMoveMarkers: true,
        },
      ]);
      editor.pushUndoStop();
      monaco.editor.setModelMarkers(model, "dcl", []);
      return true;
    },
    showSuggestions() {
      triggerSuggest(editor);
    },
    layout() {
      editor.layout();
    },
    dispose() {
      const model = editor.getModel();
      if (model) monaco.editor.setModelMarkers(model, "dcl", []);
      if (revealHighlightTimer) window.clearTimeout(revealHighlightTimer);
      subscription.dispose();
      editor.dispose();
    },
  };
}

function hasSourceLocation(location: SourceLocation): boolean {
  return Number.isInteger(location.line) && location.line > 0;
}

function triggerSuggestionsForKnownPrefix(editor: monaco.editor.IStandaloneCodeEditor): void {
  const model = editor.getModel();
  const position = editor.getPosition();
  if (!model || !position) return;

  const word = model.getWordUntilPosition(position).word;
  if (!autoSuggestPrefixes.has(word)) return;

  window.setTimeout(() => {
    triggerSuggest(editor);
  }, 0);
}

function triggerSuggest(editor: monaco.editor.IStandaloneCodeEditor): void {
  editor.focus();
  editor.trigger("dcl-playground", "editor.action.triggerSuggest", {});
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
