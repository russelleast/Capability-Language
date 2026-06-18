import * as vscode from "vscode";
import { DclCompilerAdapter, DclCompilerError } from "./compiler/DclCompilerAdapter";
import { DclDiagnosticProvider } from "./diagnostics/DclDiagnosticProvider";
import { DclFormattingProvider } from "./formatting/DclFormattingProvider";
import { DclHoverProvider } from "./hovers/DclHoverProvider";
import { buildCapabilityGraph } from "./graphs/DclCapabilityGraphBuilder";
import { buildLifecycleGraph } from "./graphs/DclLifecycleGraphBuilder";
import { DclSourceLocation, revealSourceLocation } from "./source/DclSourceLocation";
import { DclExplorerNode, DclExplorerProvider } from "./views/DclExplorerProvider";
import { DclSummaryProvider } from "./views/DclSummaryProvider";
import { SemanticSummary } from "./views/semanticSummary";
import { DclCapabilityGraphPanel } from "./webviews/DclCapabilityGraphPanel";
import { DclLifecycleGraphPanel } from "./webviews/DclLifecycleGraphPanel";

const DCL_SELECTOR: vscode.DocumentSelector = { language: "dcl", scheme: "file" };

export function activate(context: vscode.ExtensionContext): void {
  const compiler = new DclCompilerAdapter(vscode.workspace.workspaceFolders);
  const diagnostics = new DclDiagnosticProvider(compiler);
  const summary = new DclSummaryProvider();
  const explorer = new DclExplorerProvider();

  context.subscriptions.push(
    diagnostics,
    vscode.languages.registerHoverProvider(DCL_SELECTOR, new DclHoverProvider()),
    vscode.languages.registerDocumentFormattingEditProvider(DCL_SELECTOR, new DclFormattingProvider(compiler)),
    vscode.window.registerTreeDataProvider("dclSemanticSummary", summary),
    vscode.window.registerTreeDataProvider("dclExplorer", explorer),
    vscode.commands.registerCommand("dcl.compileCurrentFile", () => compileCurrentFile(diagnostics, summary, explorer, false)),
    vscode.commands.registerCommand("dcl.compileWorkspace", () => compileWorkspace(diagnostics, summary, explorer)),
    vscode.commands.registerCommand("dcl.showSemanticSummary", () => compileCurrentFile(diagnostics, summary, explorer, true)),
    vscode.commands.registerCommand("dcl.formatDocument", () => vscode.commands.executeCommand("editor.action.formatDocument")),
    vscode.commands.registerCommand("dcl.refreshExplorer", () => refreshExplorer(diagnostics, summary, explorer)),
    vscode.commands.registerCommand("dcl.revealSemanticItemInSource", (location?: DclSourceLocation) => revealSemanticItemInSource(location)),
    vscode.commands.registerCommand("dcl.showCapabilityGraph", (node?: DclExplorerNode) => showCapabilityGraph(context.extensionUri, explorer, node)),
    vscode.commands.registerCommand("dcl.showLifecycleGraph", (node?: DclExplorerNode) => showLifecycleGraph(context.extensionUri, explorer, node)),
    vscode.workspace.onDidSaveTextDocument((document) => {
      const compileOnSave = vscode.workspace.getConfiguration("dcl").get<boolean>("compileOnSave", true);
      if (compileOnSave && document.languageId === "dcl" && document.uri.scheme === "file") {
        void compileFiles([document.uri], diagnostics, summary, explorer, false, false);
      }
    }),
  );
}

async function showCapabilityGraph(
  extensionUri: vscode.Uri,
  explorer: DclExplorerProvider,
  node: DclExplorerNode | undefined,
): Promise<void> {
  const summary = explorer.getSummary();
  if (!summary?.capabilities.length) {
    DclCapabilityGraphPanel.showEmpty(
      extensionUri,
      "No Compiled Semantic Summary",
      "Compile DCL before opening a capability graph.",
    );
    return;
  }

  let capabilityName = node?.kind === "capability" ? node.capabilityName : undefined;
  if (!capabilityName) {
    capabilityName = await pickCapability(summary);
  }

  if (!capabilityName) {
    DclCapabilityGraphPanel.showEmpty(
      extensionUri,
      "No Capability Selected",
      "Select a compiled capability to render its capability graph.",
      graphCapabilityPicks(summary),
      () => switchCapabilityGraph(extensionUri, explorer),
    );
    return;
  }

  showGraphForCapability(extensionUri, explorer, summary, capabilityName);
}

async function switchCapabilityGraph(extensionUri: vscode.Uri, explorer: DclExplorerProvider): Promise<void> {
  const summary = explorer.getSummary();
  if (!summary?.capabilities.length) {
    DclCapabilityGraphPanel.showEmpty(
      extensionUri,
      "No Compiled Semantic Summary",
      "Compile DCL before switching capability graphs.",
    );
    return;
  }

  const capabilityName = await pickCapability(summary);
  if (!capabilityName) return;
  showGraphForCapability(extensionUri, explorer, summary, capabilityName);
}

function showGraphForCapability(
  extensionUri: vscode.Uri,
  explorer: DclExplorerProvider,
  summary: SemanticSummary,
  capabilityName: string,
): void {
  const graph = buildCapabilityGraph(summary, capabilityName);
  if (!graph) {
    void vscode.window.showWarningMessage(`No compiler summary found for capability '${capabilityName}'.`);
    return;
  }

  DclCapabilityGraphPanel.show(
    extensionUri,
    graph,
    graphCapabilityPicks(summary),
    () => switchCapabilityGraph(extensionUri, explorer),
  );
}

async function pickCapability(summary: SemanticSummary): Promise<string | undefined> {
  const picked = await vscode.window.showQuickPick(
    summary.capabilities.map((capability) => ({
      label: capability.name,
      description: capability.context,
    })),
    { title: "Select DCL Capability" },
  );
  return picked?.label;
}

function graphCapabilityPicks(summary: SemanticSummary): Array<{ name: string; context?: string }> {
  return summary.capabilities.map((capability) => ({
    name: capability.name,
    context: capability.context,
  }));
}

async function showLifecycleGraph(
  extensionUri: vscode.Uri,
  explorer: DclExplorerProvider,
  node: DclExplorerNode | undefined,
): Promise<void> {
  const summary = explorer.getSummary();
  if (!summary?.capabilities.length) {
    DclLifecycleGraphPanel.showEmpty(
      extensionUri,
      "No Compiled Semantic Summary",
      "Compile DCL before opening a lifecycle graph.",
    );
    return;
  }

  let capabilityName = node?.kind === "capability" || node?.kind === "lifecycle" ? node.capabilityName : undefined;
  if (!capabilityName) {
    capabilityName = await pickLifecycleCapability(summary);
  }

  if (!capabilityName) return;
  showLifecycleGraphForCapability(extensionUri, summary, capabilityName);
}

function showLifecycleGraphForCapability(extensionUri: vscode.Uri, summary: SemanticSummary, capabilityName: string): void {
  const capability = summary.capabilities.find((item) => item.name === capabilityName);
  if (!capability?.lifecycle) {
    DclLifecycleGraphPanel.showEmpty(
      extensionUri,
      "No Lifecycle Available",
      `Capability '${capabilityName}' does not have lifecycle data in the compiled semantic summary.`,
    );
    return;
  }

  const graph = buildLifecycleGraph(summary, capabilityName);
  if (!graph) {
    DclLifecycleGraphPanel.showEmpty(
      extensionUri,
      "No Lifecycle Available",
      `Capability '${capabilityName}' does not have lifecycle data in the compiled semantic summary.`,
    );
    return;
  }

  DclLifecycleGraphPanel.show(extensionUri, graph);
}

async function pickLifecycleCapability(summary: SemanticSummary): Promise<string | undefined> {
  const choices = summary.capabilities
    .filter((capability) => capability.lifecycle)
    .map((capability) => ({
      label: capability.name,
      description: capability.context,
      detail: lifecyclePickDetail(capability),
    }));

  if (!choices.length) {
    void vscode.window.showWarningMessage("No compiled capabilities include lifecycle data.");
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(choices, { title: "Select DCL Lifecycle" });
  return picked?.label;
}

function lifecyclePickDetail(capability: SemanticSummary["capabilities"][number]): string | undefined {
  const begin = capability.lifecycle?.begin ? `begin ${capability.lifecycle.begin}` : undefined;
  const transitions = capability.lifecycle?.transitionDetails?.length
    ? `${capability.lifecycle.transitionDetails.length} transition${capability.lifecycle.transitionDetails.length === 1 ? "" : "s"}`
    : undefined;
  return [begin, transitions].filter(Boolean).join(", ") || undefined;
}

export function deactivate(): void {}

async function compileCurrentFile(
  diagnostics: DclDiagnosticProvider,
  summary: DclSummaryProvider,
  explorer: DclExplorerProvider,
  revealSummary: boolean,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "dcl") {
    void vscode.window.showWarningMessage("Open a .dcl file before running this DCL command.");
    return;
  }

  await editor.document.save();
  await compileFiles([editor.document.uri], diagnostics, summary, explorer, revealSummary, true);
}

async function compileWorkspace(
  diagnostics: DclDiagnosticProvider,
  summary: DclSummaryProvider,
  explorer: DclExplorerProvider,
): Promise<void> {
  const files = await vscode.workspace.findFiles("**/*.dcl", "**/{node_modules,.git}/**");
  if (files.length === 0) {
    diagnostics.clear();
    summary.clear();
    explorer.showNoDclFiles();
    void vscode.window.showInformationMessage("No .dcl files found in this workspace.");
    return;
  }

  await compileFiles(files, diagnostics, summary, explorer, false, true);
}

async function refreshExplorer(
  diagnostics: DclDiagnosticProvider,
  summary: DclSummaryProvider,
  explorer: DclExplorerProvider,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor?.document.languageId === "dcl" && editor.document.uri.scheme === "file") {
    await compileCurrentFile(diagnostics, summary, explorer, false);
    return;
  }

  await compileWorkspace(diagnostics, summary, explorer);
}

async function compileFiles(
  files: vscode.Uri[],
  diagnostics: DclDiagnosticProvider,
  summary: DclSummaryProvider,
  explorer: DclExplorerProvider,
  revealSummary: boolean,
  showStatus: boolean,
): Promise<void> {
  try {
    const result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: files.length === 1 ? "Compiling DCL file" : `Compiling ${files.length} DCL files`,
      },
      () => diagnostics.compileFiles(files),
    );

    if (result.ir) {
      summary.refresh(result.ir);
      explorer.refresh(result.ir);
    } else if (!result.ok) {
      summary.clear();
      explorer.showCompileFailed();
    } else {
      summary.clear();
      explorer.clear();
    }

    if (revealSummary) {
      await vscode.commands.executeCommand("dclSemanticSummary.focus");
    }

    if (showStatus) {
      const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
      const warnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
      const message = result.ok
        ? `DCL compile completed: ${warnings} warning${warnings === 1 ? "" : "s"}.`
        : `DCL compile failed: ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}.`;
      void vscode.window.showInformationMessage(message);
    }
  } catch (error) {
    diagnostics.clear();
    summary.clear();
    const message = error instanceof DclCompilerError ? error.message : String(error);
    if (error instanceof DclCompilerError && /unable to run dcl compiler/i.test(error.message)) {
      explorer.showCompilerUnavailable();
    } else {
      explorer.showCompileFailed();
    }
    void vscode.window.showErrorMessage(message);
  }
}

async function revealSemanticItemInSource(location: DclSourceLocation | undefined): Promise<void> {
  const result = await revealSourceLocation(location, "oneBased");
  if (!result.ok) {
    void vscode.window.showWarningMessage(result.reason);
  }
}
