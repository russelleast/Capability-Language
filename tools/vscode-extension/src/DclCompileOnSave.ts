import * as vscode from "vscode";

export type DclCompileOnSaveMode = "workspace" | "file" | "off";

type ConfigurationLike = Pick<vscode.WorkspaceConfiguration, "get" | "inspect">;

type SavedDocumentLike = Pick<vscode.TextDocument, "languageId" | "uri">;

type TimerHandle = ReturnType<typeof setTimeout>;

type CompileOnSaveSchedulerOptions = {
  delayMs?: number;
  compileWorkspace(): void | Promise<unknown>;
  compileFile(uri: vscode.Uri): void | Promise<unknown>;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
};

const DEFAULT_DEBOUNCE_MS = 500;

export function resolveCompileOnSaveMode(configuration: ConfigurationLike): DclCompileOnSaveMode {
  const explicitMode = explicitConfigurationValue(configuration, "compileOnSaveMode");
  if (isCompileOnSaveMode(explicitMode)) {
    return explicitMode;
  }

  const legacyCompileOnSave = configuration.get<boolean>("compileOnSave", true);
  return legacyCompileOnSave ? "workspace" : "off";
}

export class DclCompileOnSaveScheduler {
  private readonly delayMs: number;
  private readonly compileWorkspace: () => void | Promise<unknown>;
  private readonly compileFile: (uri: vscode.Uri) => void | Promise<unknown>;
  private readonly setTimer: typeof setTimeout;
  private readonly clearTimer: typeof clearTimeout;
  private pendingWorkspaceCompile: TimerHandle | undefined;

  constructor(options: CompileOnSaveSchedulerOptions) {
    this.delayMs = options.delayMs ?? DEFAULT_DEBOUNCE_MS;
    this.compileWorkspace = options.compileWorkspace;
    this.compileFile = options.compileFile;
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
  }

  handleSavedDocument(document: SavedDocumentLike, mode: DclCompileOnSaveMode): void {
    if (document.languageId !== "dcl" || document.uri.scheme !== "file" || mode === "off") {
      return;
    }

    if (mode === "file") {
      void this.compileFile(document.uri);
      return;
    }

    this.scheduleWorkspaceCompile();
  }

  dispose(): void {
    if (this.pendingWorkspaceCompile) {
      this.clearTimer(this.pendingWorkspaceCompile);
      this.pendingWorkspaceCompile = undefined;
    }
  }

  private scheduleWorkspaceCompile(): void {
    if (this.pendingWorkspaceCompile) {
      this.clearTimer(this.pendingWorkspaceCompile);
    }

    this.pendingWorkspaceCompile = this.setTimer(() => {
      this.pendingWorkspaceCompile = undefined;
      void this.compileWorkspace();
    }, this.delayMs);
  }
}

function explicitConfigurationValue(configuration: ConfigurationLike, key: string): unknown {
  const inspected = configuration.inspect?.<unknown>(key);
  if (!inspected) return undefined;

  return inspected.workspaceFolderLanguageValue
    ?? inspected.workspaceFolderValue
    ?? inspected.workspaceLanguageValue
    ?? inspected.workspaceValue
    ?? inspected.globalLanguageValue
    ?? inspected.globalValue;
}

function isCompileOnSaveMode(value: unknown): value is DclCompileOnSaveMode {
  return value === "workspace" || value === "file" || value === "off";
}
