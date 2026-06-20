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

export class Location {
  constructor(
    public readonly uri: Uri,
    public readonly range: Range,
  ) {}
}

export enum SymbolKind {
  File = 0,
  Module = 1,
  Namespace = 2,
  Package = 3,
  Class = 4,
  Method = 5,
  Property = 6,
  Field = 7,
  Constructor = 8,
  Enum = 9,
  Interface = 10,
  Function = 11,
  Variable = 12,
  Constant = 13,
  String = 14,
  Number = 15,
  Boolean = 16,
  Array = 17,
  Object = 18,
  Key = 19,
  Null = 20,
  EnumMember = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

export class DocumentSymbol {
  children: DocumentSymbol[] = [];

  constructor(
    public readonly name: string,
    public readonly detail: string,
    public readonly kind: SymbolKind,
    public readonly range: Range,
    public readonly selectionRange: Range,
  ) {}
}

export class SymbolInformation {
  constructor(
    public readonly name: string,
    public readonly kind: SymbolKind,
    public readonly containerName: string,
    public readonly location: Location,
  ) {}
}

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

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
}

export class EventEmitter<T> {
  readonly event = () => undefined;
  fire(_value?: T): void {}
}

export class Uri {
  scheme = "file";

  constructor(public readonly fsPath: string) {}

  static file(file: string): Uri {
    return new Uri(path.resolve(file));
  }

  static parse(value: string): Uri {
    if (value.startsWith("file://")) {
      return new Uri(value.replace(/^file:\/\//, ""));
    }
    return new Uri(value);
  }

  static joinPath(base: Uri, ...segments: string[]): Uri {
    return new Uri(path.join(base.fsPath, ...segments));
  }

  toString(): string {
    return `file://${this.fsPath}`;
  }
}

export const workspace = {
  workspaceFolders: [] as { uri: Uri }[],
  compilerPath: "",
  configuration: {} as Record<string, unknown>,
  files: [] as Uri[],
  textDocuments: [] as TextDocument[],
  getConfiguration(section?: string) {
    return {
      get<T>(key: string, defaultValue: T): T {
        const fullKey = section ? `${section}.${key}` : key;
        if (Object.prototype.hasOwnProperty.call(workspace.configuration, fullKey)) {
          return workspace.configuration[fullKey] as T;
        }
        if (key === "compilerPath" || fullKey === "dcl.compilerPath") {
          return (workspace.compilerPath || defaultValue) as T;
        }
        return defaultValue;
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
  onDidOpenTextDocument(_listener: (document: TextDocument) => void): { dispose(): void } {
    return { dispose() {} };
  },
  onDidChangeTextDocument(_listener: (event: { document: TextDocument }) => void): { dispose(): void } {
    return { dispose() {} };
  },
  onDidSaveTextDocument(_listener: (document: TextDocument) => void): { dispose(): void } {
    return { dispose() {} };
  },
  onDidCloseTextDocument(_listener: (document: TextDocument) => void): { dispose(): void } {
    return { dispose() {} };
  },
};

export type TextDocument = {
  uri: Uri;
  languageId: string;
  version: number;
  getText(): string;
};

export const window = {
  lastShownDocument: undefined as unknown,
  activeTextEditor: undefined as { document: TextDocument; selection: { active: Position } } | undefined,
  informationMessages: [] as string[],
  outputChannels: [] as MockOutputChannel[],
  createdWebviewPanels: [] as MockWebviewPanel[],
  async showTextDocument(document: unknown) {
    window.lastShownDocument = document;
    return {
      selection: undefined as Selection | undefined,
      revealRange(_range: Range, _type?: TextEditorRevealType): void {},
    };
  },
  showWarningMessage(_message: string): void {},
  showErrorMessage(_message: string): void {},
  showInformationMessage(message: string): void {
    window.informationMessages.push(message);
  },
  createOutputChannel(name: string): MockOutputChannel {
    const channel = new MockOutputChannel(name);
    window.outputChannels.push(channel);
    return channel;
  },
  registerTreeDataProvider(): { dispose(): void } {
    return { dispose() {} };
  },
  createWebviewPanel(
    viewType: string,
    title: string,
    showOptions: ViewColumn,
    _options: unknown,
  ): MockWebviewPanel {
    const panel = new MockWebviewPanel(viewType, title, showOptions);
    window.createdWebviewPanels.push(panel);
    return panel;
  },
};

export class MockOutputChannel {
  readonly lines: string[] = [];
  disposed = false;

  constructor(public readonly name: string) {}

  append(value: string): void {
    this.lines.push(value);
  }

  appendLine(value: string): void {
    this.lines.push(value);
  }

  dispose(): void {
    this.disposed = true;
  }
}

export class MockWebview {
  html = "";
  readonly postedMessages: unknown[] = [];
  private messageHandler: ((message: unknown) => void) | undefined;

  asWebviewUri(uri: Uri): Uri {
    return uri;
  }

  onDidReceiveMessage(handler: (message: unknown) => void): { dispose(): void } {
    this.messageHandler = handler;
    return { dispose: () => { this.messageHandler = undefined; } };
  }

  async postMessage(message: unknown): Promise<boolean> {
    this.postedMessages.push(message);
    return true;
  }

  emitMessage(message: unknown): void {
    this.messageHandler?.(message);
  }
}

export class MockWebviewPanel {
  readonly webview = new MockWebview();
  readonly revealCalls: Array<ViewColumn | undefined> = [];
  private disposeHandler: (() => void) | undefined;

  constructor(
    public readonly viewType: string,
    public title: string,
    public readonly showOptions: ViewColumn,
  ) {}

  reveal(column?: ViewColumn): void {
    this.revealCalls.push(column);
  }

  onDidDispose(handler: () => void): { dispose(): void } {
    this.disposeHandler = handler;
    return { dispose: () => { this.disposeHandler = undefined; } };
  }

  dispose(): void {
    this.disposeHandler?.();
  }
}

export const languages = {
  documentSymbolProviders: [] as unknown[],
  workspaceSymbolProviders: [] as unknown[],
  definitionProviders: [] as unknown[],
  referenceProviders: [] as unknown[],
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
  registerDocumentSymbolProvider(_selector: unknown, provider: unknown): { dispose(): void } {
    languages.documentSymbolProviders.push(provider);
    return { dispose() {} };
  },
  registerWorkspaceSymbolProvider(provider: unknown): { dispose(): void } {
    languages.workspaceSymbolProviders.push(provider);
    return { dispose() {} };
  },
  registerDefinitionProvider(_selector: unknown, provider: unknown): { dispose(): void } {
    languages.definitionProviders.push(provider);
    return { dispose() {} };
  },
  registerReferenceProvider(_selector: unknown, provider: unknown): { dispose(): void } {
    languages.referenceProviders.push(provider);
    return { dispose() {} };
  },
};
