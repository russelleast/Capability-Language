import * as vscode from "vscode";
import { DclCompileOnSaveScheduler, resolveCompileOnSaveMode } from "./DclCompileOnSave";
import { DclCompilerAdapter, DclCompilerError } from "./compiler/DclCompilerAdapter";
import { DclDiagnosticProvider } from "./diagnostics/DclDiagnosticProvider";
import { DclFormattingProvider } from "./formatting/DclFormattingProvider";
import { DclHoverProvider } from "./hovers/DclHoverProvider";
import { DclLanguageServerClient } from "./lsp/DclLanguageServerClient";
import { buildArchitectureOverviewGraphs } from "./graphs/DclArchitectureOverviewGraphBuilder";
import { buildCapabilityGraph } from "./graphs/DclCapabilityGraphBuilder";
import { buildContextMapGraph } from "./graphs/DclContextMapGraphBuilder";
import { buildEventFlowGraph } from "./graphs/DclEventFlowGraphBuilder";
import { buildGraphWorkspaceState, DclGraphWorkspaceSelection } from "./graphs/DclGraphWorkspaceState";
import { buildLifecycleGraph } from "./graphs/DclLifecycleGraphBuilder";
import { DclSemanticIdentity } from "./graphs/DclSemanticIdentity";
import {
  buildSemanticNavigationItems,
  DclSemanticNavigationItem,
  findSemanticNavigationItem,
  relatedSemanticItems,
  semanticInspectorText,
} from "./navigation/DclSemanticNavigation";
import { semanticIdentityAtSourcePosition } from "./source/DclSourceSelection";
import { DclSourceLocation, revealSourceLocation } from "./source/DclSourceLocation";
import { DclExplorerNode, DclExplorerProvider } from "./views/DclExplorerProvider";
import { DclSummaryProvider } from "./views/DclSummaryProvider";
import { SemanticSummary } from "./views/semanticSummary";
import { DclArchitectureOverviewGraphPanel } from "./webviews/DclArchitectureOverviewGraphPanel";
import { DclCapabilityGraphPanel } from "./webviews/DclCapabilityGraphPanel";
import { DclContextMapGraphPanel } from "./webviews/DclContextMapGraphPanel";
import { DclEventFlowGraphPanel } from "./webviews/DclEventFlowGraphPanel";
import { DclGraphWorkspacePanel } from "./webviews/DclGraphWorkspacePanel";
import { DclLifecycleGraphPanel } from "./webviews/DclLifecycleGraphPanel";

const DCL_SELECTOR: vscode.DocumentSelector = { language: "dcl", scheme: "file" };
const GRAPH_SOURCE_REVEAL_SUPPRESSION_MS = 750;
let suppressSourceToGraphUntil = 0;

export function activate(context: vscode.ExtensionContext): void {
  const languageServerEnabled = isLanguageServerEnabled();
  const compiler = new DclCompilerAdapter(vscode.workspace.workspaceFolders, {
    extensionPath: context.extensionUri.fsPath,
  });
  const diagnostics = new DclDiagnosticProvider(compiler, { publishDiagnostics: !languageServerEnabled });
  const summary = new DclSummaryProvider();
  const explorer = new DclExplorerProvider();
  const explorerView = vscode.window.createTreeView("dclExplorer", { treeDataProvider: explorer });
  const languageServer = new DclLanguageServerClient(context.extensionUri);
  languageServer.startIfEnabled();
  let sourceSelectionTimer: ReturnType<typeof setTimeout> | undefined;
  const compileOnSave = new DclCompileOnSaveScheduler({
    compileWorkspace: () => compileWorkspace(diagnostics, summary, explorer, { showCompletionNotification: false }),
    compileFile: (uri) => compileFiles([uri], diagnostics, summary, explorer, false, false),
  });

  context.subscriptions.push(
    diagnostics,
    vscode.languages.registerHoverProvider(DCL_SELECTOR, new DclHoverProvider()),
    vscode.languages.registerDocumentFormattingEditProvider(DCL_SELECTOR, new DclFormattingProvider(compiler)),
    vscode.window.registerTreeDataProvider("dclSemanticSummary", summary),
    explorerView,
    vscode.commands.registerCommand("dcl.compileCurrentFile", () => compileCurrentFile(diagnostics, summary, explorer, false)),
    vscode.commands.registerCommand("dcl.compileWorkspace", () => compileWorkspace(diagnostics, summary, explorer)),
    vscode.commands.registerCommand("dcl.showSemanticSummary", () => compileCurrentFile(diagnostics, summary, explorer, true)),
    vscode.commands.registerCommand("dcl.showCompilerInfo", () => showCompilerInfo(compiler)),
    vscode.commands.registerCommand("dcl.showLanguageServerStatus", () => languageServer.showStatus()),
    vscode.commands.registerCommand("dcl.showLspFeatureStatus", () => languageServer.showFeatureStatus()),
    vscode.commands.registerCommand("dcl.inspectSymbolAtCursor", () => languageServer.inspectSymbolAtCursor()),
    vscode.commands.registerCommand("dcl.formatDocument", () => vscode.commands.executeCommand("editor.action.formatDocument")),
    vscode.commands.registerCommand("dcl.refreshExplorer", () => refreshExplorer(diagnostics, summary, explorer)),
    vscode.commands.registerCommand("dcl.revealSemanticItemInSource", (location?: DclSourceLocation) => revealSemanticItemInSource(location)),
    vscode.commands.registerCommand("dcl.navigateSymbol", () => navigateSymbol(explorer)),
    vscode.commands.registerCommand("dcl.findRelatedElements", () => findRelatedElements(explorer)),
    vscode.commands.registerCommand("dcl.openSemanticInspector", () => openSemanticInspector(explorer)),
    vscode.commands.registerCommand("dcl.focusGraphFromExplorer", (node?: DclExplorerNode) => focusExplorerNodeInGraph(context.extensionUri, diagnostics, summary, explorer, node, true)),
    vscode.commands.registerCommand("dcl.openGraphWorkspace", () => openGraphWorkspace(context.extensionUri, diagnostics, summary, explorer)),
    vscode.commands.registerCommand("dcl.exportCurrentGraph", () => DclGraphWorkspacePanel.exportCurrentGraph()),
    vscode.commands.registerCommand("dcl.showArchitectureOverview", () => openGraphWorkspace(context.extensionUri, diagnostics, summary, explorer, { graphType: "architecture" })),
    vscode.commands.registerCommand("dcl.showCapabilityGraph", (node?: DclExplorerNode) => openGraphWorkspace(context.extensionUri, diagnostics, summary, explorer, { graphType: "capability", subject: node?.capabilityName })),
    vscode.commands.registerCommand("dcl.showContextMap", (node?: DclExplorerNode) => openGraphWorkspace(context.extensionUri, diagnostics, summary, explorer, { graphType: "context-map", subject: node?.kind === "context" ? String(node.label) : undefined })),
    vscode.commands.registerCommand("dcl.showEventFlowGraph", (node?: DclExplorerNode) => openGraphWorkspace(context.extensionUri, diagnostics, summary, explorer, { graphType: "event-flow", subject: node?.eventName })),
    vscode.commands.registerCommand("dcl.showLifecycleGraph", (node?: DclExplorerNode) => openGraphWorkspace(context.extensionUri, diagnostics, summary, explorer, { graphType: "lifecycle", subject: node?.capabilityName })),
    compileOnSave,
    explorerView.onDidChangeSelection((event) => {
      const node = event.selection[0];
      if (node) focusExplorerNodeInGraph(context.extensionUri, diagnostics, summary, explorer, node, false);
    }),
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (sourceSelectionTimer) clearTimeout(sourceSelectionTimer);
      sourceSelectionTimer = setTimeout(() => {
        followSourceSelection(event, explorer, suppressSourceToGraphUntil);
      }, 250);
    }),
    { dispose: () => { if (sourceSelectionTimer) clearTimeout(sourceSelectionTimer); } },
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isLanguageServerEnabled()) return;
      compileOnSave.handleSavedDocument(document, resolveCompileOnSaveMode(vscode.workspace.getConfiguration("dcl")));
    }),
    languageServer,
  );
}

async function navigateSymbol(explorer: DclExplorerProvider): Promise<void> {
  const item = await pickSemanticItem(explorer.getSummary(), "Navigate DCL Symbol");
  if (item) await revealAndFocusSemanticItem(item);
}

async function findRelatedElements(explorer: DclExplorerProvider): Promise<void> {
  const summary = explorer.getSummary();
  const selected = await currentOrPickedSemanticItem(summary, "Find Related Elements");
  if (!summary || !selected) return;

  const related = relatedSemanticItems(summary, selected);
  if (!related.length) {
    void vscode.window.showInformationMessage(`No related DCL elements found for ${selected.label}.`);
    return;
  }

  const picked = await pickFromItems(related, `Related to ${selected.displayName}`);
  if (picked) await revealAndFocusSemanticItem(picked);
}

async function openSemanticInspector(explorer: DclExplorerProvider): Promise<void> {
  const item = await currentOrPickedSemanticItem(explorer.getSummary(), "Open Semantic Inspector");
  if (!item) return;
  void vscode.window.showInformationMessage(semanticInspectorText(item), { modal: true });
}

async function currentOrPickedSemanticItem(
  summary: SemanticSummary | undefined,
  title: string,
): Promise<DclSemanticNavigationItem | undefined> {
  if (!summary) {
    void vscode.window.showWarningMessage("Compile DCL before using semantic navigation.");
    return undefined;
  }

  const editor = vscode.window.activeTextEditor;
  const identity = editor?.document.languageId === "dcl"
    ? semanticIdentityAtSourcePosition(summary, editor.document.uri, editor.selection.active)
    : undefined;
  const items = buildSemanticNavigationItems(summary);
  return findSemanticNavigationItem(items, identity) ?? pickFromItems(items, title);
}

async function pickSemanticItem(
  summary: SemanticSummary | undefined,
  title: string,
): Promise<DclSemanticNavigationItem | undefined> {
  if (!summary) {
    void vscode.window.showWarningMessage("Compile DCL before using semantic navigation.");
    return undefined;
  }
  return pickFromItems(buildSemanticNavigationItems(summary), title);
}

async function pickFromItems(
  items: DclSemanticNavigationItem[],
  title: string,
): Promise<DclSemanticNavigationItem | undefined> {
  const picked = await vscode.window.showQuickPick(
    items.map((item) => ({
      label: item.label,
      description: item.context ?? item.parentCapability,
      detail: item.relationships.join("; ") || item.source?.file,
      item,
    })),
    {
      title,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: "Search contexts, capabilities, events, effects, policies, actors, lifecycles, and lifecycle steps",
    },
  );
  return picked?.item;
}

async function revealAndFocusSemanticItem(item: DclSemanticNavigationItem): Promise<void> {
  if (item.source) {
    const result = await revealSourceLocation(item.source, "oneBased");
    if (!result.ok) void vscode.window.showWarningMessage(result.reason);
  }
  if (item.identity) DclGraphWorkspacePanel.focusSemanticIdentity(item.identity);
}

function followSourceSelection(event: vscode.TextEditorSelectionChangeEvent, explorer: DclExplorerProvider, suppressUntil: number): void {
  const document = event.textEditor.document;
  if (document.languageId !== "dcl" || document.uri.scheme !== "file") return;
  if (Date.now() < suppressUntil) return;
  if (!vscode.workspace.getConfiguration("dcl.graph").get<boolean>("followSourceSelection", true)) return;
  const autoReveal = vscode.workspace.getConfiguration("dcl.graph").get<boolean>("autoRevealFromSource", false);
  if (!autoReveal && !DclGraphWorkspacePanel.isVisible()) return;
  const position = event.selections[0]?.active;
  if (!position) return;
  const identity = semanticIdentityAtSourcePosition(explorer.getSummary(), document.uri, position);
  if (identity) DclGraphWorkspacePanel.focusSemanticIdentity(identity, { reveal: autoReveal });
}

function focusExplorerNodeInGraph(
  extensionUri: vscode.Uri,
  diagnostics: DclDiagnosticProvider,
  summaryProvider: DclSummaryProvider,
  explorer: DclExplorerProvider,
  node: DclExplorerNode | undefined,
  showMessage: boolean,
): void {
  const identity = node?.semanticIdentity;
  if (!identity) return;

  if (DclGraphWorkspacePanel.focusSemanticIdentity(identity)) {
    return;
  }

  const compiledSummary = explorer.getSummary();
  if (!compiledSummary) {
    if (showMessage) void vscode.window.showWarningMessage("Compile DCL before focusing Explorer items in the Graph Workspace.");
    return;
  }

  const selection = graphSelectionForIdentity(identity);
  if (!selection) return;
  openGraphWorkspace(extensionUri, diagnostics, summaryProvider, explorer, selection);
}

function graphSelectionForIdentity(identity: DclSemanticIdentity): DclGraphWorkspaceSelection | undefined {
  switch (identity.kind) {
    case "capability":
      return { graphType: "capability", subject: identity.name, focusIdentity: identity };
    case "event":
      return { graphType: "event-flow", subject: identity.name, focusIdentity: identity };
    case "context":
      return { graphType: "context-map", subject: identity.name, focusIdentity: identity };
    case "lifecycle":
      return { graphType: "lifecycle", subject: identity.name, focusIdentity: identity };
    default:
      return undefined;
  }
}

function openGraphWorkspace(
  extensionUri: vscode.Uri,
  diagnostics: DclDiagnosticProvider,
  summaryProvider: DclSummaryProvider,
  explorer: DclExplorerProvider,
  selection: DclGraphWorkspaceSelection = {},
): void {
  const callbacks = {
    onSelectionChanged(nextSelection: DclGraphWorkspaceSelection) {
      openGraphWorkspace(extensionUri, diagnostics, summaryProvider, explorer, nextSelection);
    },
    onRefresh() {
      openGraphWorkspace(extensionUri, diagnostics, summaryProvider, explorer, selection);
    },
    onCompileWorkspace() {
      void compileWorkspace(diagnostics, summaryProvider, explorer).then(() => {
        if (explorer.getSummary()) {
          openGraphWorkspace(extensionUri, diagnostics, summaryProvider, explorer, selection);
        }
      });
    },
    async onRevealSource(location: DclSourceLocation) {
      await revealGraphSource(location);
    },
  };

  const compiledSummary = explorer.getSummary();
  if (!compiledSummary) {
    DclGraphWorkspacePanel.showNoSummary(extensionUri, callbacks);
    return;
  }

  DclGraphWorkspacePanel.show(extensionUri, buildGraphWorkspaceState(compiledSummary, selection), callbacks);
}

async function revealGraphSource(location: DclSourceLocation): Promise<void> {
  suppressSourceToGraphUntil = Date.now() + GRAPH_SOURCE_REVEAL_SUPPRESSION_MS;
  const result = await revealSourceLocation(location, "oneBased");
  if (!result.ok) void vscode.window.showWarningMessage(result.reason);
}

function showCompilerInfo(compiler: DclCompilerAdapter): void {
  const info = compiler.compilerInfo();
  const lines = [
    `Resolved compiler: ${info.command}${info.args.length ? ` ${info.args.join(" ")}` : ""}`,
    `Source: ${info.source}`,
    `Platform: ${info.platform}`,
    `Architecture: ${info.arch}`,
    info.cwd ? `Working directory: ${info.cwd}` : undefined,
    info.supportedBundleName ? `Bundled compiler for this platform: ${info.supportedBundleName}` : "Bundled DCL compiler is not available for this platform.",
    info.bundledPath ? `Bundled compiler path: ${info.bundledPath}` : undefined,
    `Bundled compiler available: ${info.bundledAvailable ? "yes" : "no"}`,
  ].filter(Boolean).join("\n");

  void vscode.window.showInformationMessage(lines, { modal: true });
}

function showArchitectureOverview(extensionUri: vscode.Uri, explorer: DclExplorerProvider): void {
  const summary = explorer.getSummary();
  if (!summary) {
    DclArchitectureOverviewGraphPanel.showEmpty(
      extensionUri,
      "No Compiled Semantic Summary",
      "Compile DCL before opening the architecture overview.",
    );
    return;
  }

  const graphs = buildArchitectureOverviewGraphs(summary);
  if (!graphs) {
    DclArchitectureOverviewGraphPanel.showEmpty(
      extensionUri,
      "No Architecture Items",
      "The compiled semantic summary does not include contexts or capabilities.",
    );
    return;
  }

  DclArchitectureOverviewGraphPanel.show(extensionUri, graphs);
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

async function showEventFlowGraph(
  extensionUri: vscode.Uri,
  explorer: DclExplorerProvider,
  node: DclExplorerNode | undefined,
): Promise<void> {
  const summary = explorer.getSummary();
  if (!summary?.capabilities.length) {
    DclEventFlowGraphPanel.showEmpty(
      extensionUri,
      "No Compiled Semantic Summary",
      "Compile DCL before opening an event flow graph.",
    );
    return;
  }

  const eventName = node?.kind === "event" ? node.eventName : undefined;
  const selected = eventName ?? await pickEventFlow(summary);
  if (selected === undefined) return;

  const graph = buildEventFlowGraph(summary, selected === ALL_EVENT_FLOWS ? undefined : selected);
  if (!graph) {
    DclEventFlowGraphPanel.showEmpty(
      extensionUri,
      "No Events Declared",
      "The compiled semantic summary does not include declared or referenced events.",
    );
    return;
  }

  DclEventFlowGraphPanel.show(extensionUri, graph, selected === ALL_EVENT_FLOWS ? undefined : selected);
}

const ALL_EVENT_FLOWS = "__all_event_flows__";

async function pickEventFlow(summary: SemanticSummary): Promise<string | undefined> {
  const events = eventFlowNames(summary);
  if (!events.length) {
    void vscode.window.showWarningMessage("No compiled events are available for an event flow graph.");
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    [
      { label: "All event flows", eventName: ALL_EVENT_FLOWS, description: `${events.length} event${events.length === 1 ? "" : "s"}` },
      ...events.map((event) => ({ label: event, eventName: event })),
    ],
    { title: "Select DCL Event Flow" },
  );
  return picked?.eventName;
}

function eventFlowNames(summary: SemanticSummary): string[] {
  const names = new Set<string>();
  for (const event of summary.events ?? []) names.add(event.label);
  for (const capability of summary.capabilities) {
    for (const event of capability.eventDetails ?? []) names.add(event.event);
    for (const transition of capability.lifecycle?.transitionDetails ?? []) {
      if (transition.triggerKind === "event" && transition.triggerName) names.add(transition.triggerName);
    }
  }
  return Array.from(names).sort();
}

async function showContextMap(
  extensionUri: vscode.Uri,
  explorer: DclExplorerProvider,
  node: DclExplorerNode | undefined,
): Promise<void> {
  const summary = explorer.getSummary();
  if (!summary?.contexts?.length) {
    DclContextMapGraphPanel.showEmpty(
      extensionUri,
      "No Compiled Semantic Summary",
      "Compile DCL before opening a context map.",
    );
    return;
  }

  let contextName = node?.kind === "context" ? String(node.label) : undefined;
  if (!contextName && node?.contextValue !== "dclExplorer.contexts") {
    contextName = await pickContext(summary);
  }

  const graph = buildContextMapGraph(summary, contextName);
  if (!graph) {
    DclContextMapGraphPanel.showEmpty(
      extensionUri,
      "No Contexts Declared",
      "The compiled semantic summary does not include declared contexts.",
    );
    return;
  }

  DclContextMapGraphPanel.show(extensionUri, graph, contextName);
}

async function pickContext(summary: SemanticSummary): Promise<string | undefined> {
  const choices = summary.contexts?.map((context) => ({
    label: context.name,
    description: context.parent ? `child of ${context.parent}` : undefined,
    detail: [
      context.children?.length ? `${context.children.length} child${context.children.length === 1 ? "" : "ren"}` : undefined,
      context.dependencies?.length ? `${context.dependencies.length} dependenc${context.dependencies.length === 1 ? "y" : "ies"}` : undefined,
    ].filter(Boolean).join(", ") || undefined,
  })) ?? [];
  const picked = await vscode.window.showQuickPick(
    [
      { label: "All contexts", contextName: undefined, description: `${choices.length} context${choices.length === 1 ? "" : "s"}` },
      ...choices.map((choice) => ({ ...choice, contextName: choice.label })),
    ],
    { title: "Select DCL Context Map" },
  );
  return picked?.contextName;
}

export function deactivate(): void {}

function isLanguageServerEnabled(): boolean {
  return vscode.workspace.getConfiguration("dcl.languageServer").get<boolean>("enabled", false);
}

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
  options: { showCompletionNotification?: boolean } = {},
): Promise<boolean> {
  const files = await vscode.workspace.findFiles("**/*.dcl", "**/{node_modules,.git}/**");
  if (files.length === 0) {
    diagnostics.clear();
    summary.clear();
    explorer.showNoDclFiles();
    void vscode.window.showInformationMessage("No .dcl files found in this workspace.");
    return true;
  }

  const status = setStatusBarMessage("DCL: compiling workspace...");
  try {
    const ok = await compileFiles(files, diagnostics, summary, explorer, false, options.showCompletionNotification ?? true);
    if (ok) {
      DclGraphWorkspacePanel.refreshCurrent();
    }
    setStatusBarMessage(ok ? "DCL: workspace compile completed" : "DCL: workspace compile failed", 3000);
    return ok;
  } finally {
    status?.dispose();
  }
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
): Promise<boolean> {
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
      const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
      const warnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
      DclGraphWorkspacePanel.showCompileFailed(
        `Compile failed with ${errors} error${errors === 1 ? "" : "s"} and ${warnings} warning${warnings === 1 ? "" : "s"}. Fix diagnostics and compile again.`,
      );
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
    return result.ok;
  } catch (error) {
    diagnostics.clear();
    summary.clear();
    const message = error instanceof DclCompilerError ? error.message : String(error);
    if (error instanceof DclCompilerError && /unable to run dcl compiler|compiler was not found|could not be started/i.test(error.message)) {
      explorer.showCompilerUnavailable();
    } else {
      explorer.showCompileFailed();
    }
    DclGraphWorkspacePanel.showCompileFailed(message);
    void vscode.window.showErrorMessage(message);
    return false;
  }
}

function setStatusBarMessage(message: string, hideAfterTimeout?: number): vscode.Disposable | undefined {
  return hideAfterTimeout === undefined
    ? vscode.window.setStatusBarMessage?.(message)
    : vscode.window.setStatusBarMessage?.(message, hideAfterTimeout);
}

async function revealSemanticItemInSource(location: DclSourceLocation | undefined): Promise<void> {
  const result = await revealSourceLocation(location, "oneBased");
  if (!result.ok) {
    void vscode.window.showWarningMessage(result.reason);
  }
}
