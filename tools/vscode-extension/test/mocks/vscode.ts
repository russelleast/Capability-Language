import * as fs from "fs";
import * as path from "path";

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class Range {
  readonly start: Position;
  readonly end: Position;

  constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number) {
    this.start = new Position(startLine, startCharacter);
    this.end = new Position(endLine, endCharacter);
  }
}

export class Selection extends Range {}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class Diagnostic {
  code: string | undefined;
  source: string | undefined;

  constructor(
    public readonly range: Range,
    public readonly message: string,
    public readonly severity: DiagnosticSeverity,
  ) {}
}

export class ThemeIcon {
  constructor(public readonly id: string) {}
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  description: string | undefined;
  contextValue: string | undefined;
  tooltip: string | undefined;
  iconPath: ThemeIcon | undefined;
  command: unknown;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None,
  ) {}
}

export enum TextEditorRevealType {
  Default = 0,
  InCenter = 1,
  InCenterIfOutsideViewport = 2,
  AtTop = 3,
}

export class EventEmitter<T> {
  readonly event = () => undefined;
  fire(_value?: T): void {}
}

export class Uri {
  constructor(public readonly fsPath: string) {}

  static file(file: string): Uri {
    return new Uri(path.resolve(file));
  }

  static joinPath(base: Uri, ...segments: string[]): Uri {
    return new Uri(path.join(base.fsPath, ...segments));
  }
}

export const workspace = {
  workspaceFolders: [] as { uri: Uri }[],
  compilerPath: "",
  files: [] as Uri[],
  getConfiguration(_section?: string) {
    return {
      get<T>(_key: string, defaultValue: T): T {
        return (workspace.compilerPath || defaultValue) as T;
      },
    };
  },
  async findFiles(): Promise<Uri[]> {
    return workspace.files;
  },
  async openTextDocument(uri: Uri) {
    const text = fs.readFileSync(uri.fsPath, "utf8");
    const lines = text.split(/\r?\n/);
    return {
      uri,
      lineCount: lines.length,
      lineAt(line: number) {
        const value = lines[line] ?? "";
        return {
          text: value,
          range: new Range(line, 0, line, value.length),
        };
      },
    };
  },
};

export const window = {
  lastShownDocument: undefined as unknown,
  async showTextDocument(document: unknown) {
    window.lastShownDocument = document;
    return {
      selection: undefined as Selection | undefined,
      revealRange(_range: Range, _type?: TextEditorRevealType): void {},
    };
  },
  showWarningMessage(_message: string): void {},
  showErrorMessage(_message: string): void {},
  showInformationMessage(_message: string): void {},
  registerTreeDataProvider(): { dispose(): void } {
    return { dispose() {} };
  },
};

export const languages = {
  createDiagnosticCollection() {
    const entries = new Map<string, Diagnostic[]>();
    return {
      entries,
      set(uri: Uri, diagnostics: Diagnostic[]) {
        entries.set(uri.fsPath, diagnostics);
      },
      clear() {
        entries.clear();
      },
      dispose() {
        entries.clear();
      },
    };
  },
};
