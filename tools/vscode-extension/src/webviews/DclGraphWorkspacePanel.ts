import * as path from "path";
import * as vscode from "vscode";
import { DclGraphExportFormat } from "../graphs/DclGraphExport";
import { DclGraphModel } from "../graphs/DclGraphModel";
import { DclGraphWorkspaceSelection, DclGraphWorkspaceState, DclGraphWorkspaceType } from "../graphs/DclGraphWorkspaceState";
import { DclSemanticIdentity, findGraphNodeBySemanticIdentity } from "../graphs/DclSemanticIdentity";

type GraphWorkspaceMessage = {
  type: "selectionChanged";
  graphType: DclGraphWorkspaceType;
  subject?: string;
  architectureDetailLevel?: "overview" | "detailed" | "full";
} | {
  type: "nodeSelected";
  nodeId: string;
} | {
  type: "revealSource";
  nodeId: string;
} | {
  type: "showInGraph";
  graphType: DclGraphWorkspaceType;
  subject?: string;
  architectureDetailLevel?: "overview" | "detailed" | "full";
  focusIdentity: DclSemanticIdentity;
} | {
  type: "refresh";
} | {
  type: "compileWorkspace";
} | {
  type: "graphExported";
  format: DclGraphExportFormat;
  filename: string;
  text?: string;
  dataUri?: string;
} | {
  type: "graphExportFailed";
  reason: string;
};

type WebviewGraphModel = Omit<DclGraphModel, "nodes"> & {
  nodes: Array<Omit<DclGraphModel["nodes"][number], "source"> & { hasSource: boolean }>;
};

type GraphWorkspaceCallbacks = {
  onSelectionChanged(selection: DclGraphWorkspaceSelection): void;
  onRefresh(): void;
  onCompileWorkspace(): void;
  onRevealSource(location: NonNullable<DclGraphModel["nodes"][number]["source"]>): void;
};

export class DclGraphWorkspacePanel {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static currentGraph: DclGraphModel | undefined;
  private static callbacks: GraphWorkspaceCallbacks | undefined;

  static show(extensionUri: vscode.Uri, state: DclGraphWorkspaceState, callbacks: GraphWorkspaceCallbacks): void {
    DclGraphWorkspacePanel.callbacks = callbacks;
    DclGraphWorkspacePanel.currentGraph = state.graph;

    if (DclGraphWorkspacePanel.currentPanel) {
      DclGraphWorkspacePanel.currentPanel.title = "DCL Graph Workspace";
      DclGraphWorkspacePanel.currentPanel.webview.html = renderHtml(
        DclGraphWorkspacePanel.currentPanel.webview,
        extensionUri,
        state,
      );
      DclGraphWorkspacePanel.currentPanel.reveal(vscode.ViewColumn.Active);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "dclGraphWorkspace",
      "DCL Graph Workspace",
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      },
    );

    DclGraphWorkspacePanel.currentPanel = panel;
    panel.webview.html = renderHtml(panel.webview, extensionUri, state);
    panel.webview.onDidReceiveMessage((message: unknown) => {
      void DclGraphWorkspacePanel.handleMessage(message);
    });
    panel.onDidDispose(() => {
      DclGraphWorkspacePanel.currentPanel = undefined;
      DclGraphWorkspacePanel.currentGraph = undefined;
      DclGraphWorkspacePanel.callbacks = undefined;
    });
  }

  static showNoSummary(extensionUri: vscode.Uri, callbacks: GraphWorkspaceCallbacks): void {
    DclGraphWorkspacePanel.showEmpty(
      extensionUri,
      "No Compiled Semantic Summary",
      "Compile your DCL workspace before opening graph views.",
      callbacks,
    );
  }

  static showCompileFailed(message = "Compile failed. Fix compiler diagnostics and refresh the graph workspace."): void {
    if (!DclGraphWorkspacePanel.currentPanel) return;
    DclGraphWorkspacePanel.currentGraph = undefined;
    DclGraphWorkspacePanel.currentPanel.webview.html = renderEmptyHtml("Compile Failed", message, true);
  }

  static refreshCurrent(): void {
    if (!DclGraphWorkspacePanel.currentPanel) return;
    DclGraphWorkspacePanel.callbacks?.onRefresh();
  }

  static isVisible(): boolean {
    return DclGraphWorkspacePanel.currentPanel?.visible === true;
  }

  static focusSemanticIdentity(identity: DclSemanticIdentity | undefined, options: { reveal?: boolean } = {}): boolean {
    const node = findGraphNodeBySemanticIdentity(DclGraphWorkspacePanel.currentGraph, identity);
    if (!node || !DclGraphWorkspacePanel.currentPanel) return false;
    if (options.reveal !== false) {
      DclGraphWorkspacePanel.currentPanel.reveal(vscode.ViewColumn.Active);
    } else if (!DclGraphWorkspacePanel.currentPanel.visible) {
      return false;
    }
    void DclGraphWorkspacePanel.currentPanel.webview.postMessage({ type: "focusNode", nodeId: node.id });
    return true;
  }

  static async exportCurrentGraph(format?: DclGraphExportFormat): Promise<void> {
    if (!DclGraphWorkspacePanel.currentPanel || !DclGraphWorkspacePanel.currentGraph) {
      void vscode.window.showWarningMessage("Open a DCL graph before exporting.");
      return;
    }

    const selected = format ?? await vscode.window.showQuickPick(
      [
        { label: "SVG", description: "Best for documentation", format: "svg" as const },
        { label: "PNG", description: "Best for quick sharing", format: "png" as const },
      ],
      { title: "Export DCL Graph" },
    ).then((item) => item?.format);

    if (!selected) return;
    await DclGraphWorkspacePanel.currentPanel.webview.postMessage({ type: "requestExport", format: selected });
  }

  private static showEmpty(
    extensionUri: vscode.Uri,
    title: string,
    message: string,
    callbacks: GraphWorkspaceCallbacks,
  ): void {
    DclGraphWorkspacePanel.callbacks = callbacks;
    DclGraphWorkspacePanel.currentGraph = undefined;

    if (DclGraphWorkspacePanel.currentPanel) {
      DclGraphWorkspacePanel.currentPanel.webview.html = renderEmptyHtml(title, message, true);
      DclGraphWorkspacePanel.currentPanel.reveal(vscode.ViewColumn.Active);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "dclGraphWorkspace",
      "DCL Graph Workspace",
      vscode.ViewColumn.Active,
      { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")] },
    );

    DclGraphWorkspacePanel.currentPanel = panel;
    panel.webview.html = renderEmptyHtml(title, message, true);
    panel.webview.onDidReceiveMessage((message: unknown) => {
      void DclGraphWorkspacePanel.handleMessage(message);
    });
    panel.onDidDispose(() => {
      DclGraphWorkspacePanel.currentPanel = undefined;
      DclGraphWorkspacePanel.currentGraph = undefined;
      DclGraphWorkspacePanel.callbacks = undefined;
    });
  }

  private static async handleMessage(message: unknown): Promise<void> {
    if (!isGraphWorkspaceMessage(message)) return;

    if (message.type === "selectionChanged") {
      DclGraphWorkspacePanel.callbacks?.onSelectionChanged({
        graphType: message.graphType,
        subject: message.subject,
        architectureDetailLevel: message.architectureDetailLevel,
      });
      return;
    }

    if (message.type === "showInGraph") {
      DclGraphWorkspacePanel.callbacks?.onSelectionChanged({
        graphType: message.graphType,
        subject: message.subject,
        architectureDetailLevel: message.architectureDetailLevel,
        focusIdentity: message.focusIdentity,
      });
      return;
    }

    if (message.type === "refresh") {
      DclGraphWorkspacePanel.callbacks?.onRefresh();
      return;
    }

    if (message.type === "compileWorkspace") {
      DclGraphWorkspacePanel.callbacks?.onCompileWorkspace();
      return;
    }

    if (message.type === "graphExportFailed") {
      void vscode.window.showErrorMessage(`DCL graph export failed: ${message.reason}`);
      return;
    }

    if (message.type === "graphExported") {
      await saveGraphExport(message);
      return;
    }

    if (message.type === "nodeSelected") return;

    const node = DclGraphWorkspacePanel.currentGraph?.nodes.find((item) => item.id === message.nodeId);
    if (!node) return;

    if (!node.source) {
      void vscode.window.showWarningMessage(`No source location is available for graph node '${node.sourceName ?? node.label}'.`);
      return;
    }

    DclGraphWorkspacePanel.callbacks?.onRevealSource(node.source);
  }
}

async function saveGraphExport(message: Extract<GraphWorkspaceMessage, { type: "graphExported" }>): Promise<void> {
  try {
    const filename = safeExportFilename(message.filename, message.format);
    const target = await vscode.window.showSaveDialog({
      defaultUri: defaultExportUri(filename),
      filters: message.format === "svg" ? { SVG: ["svg"] } : { PNG: ["png"] },
      saveLabel: `Export ${message.format.toUpperCase()}`,
    });
    if (!target) return;

    const bytes = message.format === "svg"
      ? Buffer.from(message.text ?? "", "utf8")
      : pngBytes(message.dataUri ?? "");
    if (!bytes.length) {
      throw new Error("Export payload was empty.");
    }

    await vscode.workspace.fs.writeFile(target, bytes);
    void vscode.window.showInformationMessage(`DCL graph exported to ${target.fsPath}`);
  } catch (error) {
    void vscode.window.showErrorMessage(`DCL graph export failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function safeExportFilename(filename: string, format: DclGraphExportFormat): string {
  const basename = path.basename(filename).replace(/[^a-z0-9_.-]+/gi, "-");
  return basename.toLowerCase().endsWith(`.${format}`) ? basename : `${basename}.${format}`;
}

function defaultExportUri(filename: string): vscode.Uri | undefined {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return root ? vscode.Uri.file(path.join(root, filename)) : undefined;
}

function pngBytes(dataUri: string): Buffer {
  const match = /^data:image\/png;base64,(.+)$/i.exec(dataUri);
  if (!match) throw new Error("PNG export payload was not a valid data URI.");
  return Buffer.from(match[1], "base64");
}

function renderHtml(webview: vscode.Webview, extensionUri: vscode.Uri, state: DclGraphWorkspaceState): string {
  const nonce = nonceValue();
  const cytoscapeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "cytoscape.min.js"));
  const graphJson = escapeScriptJson(state.graph ? toWebviewGraph(state.graph) : undefined);
  const stateJson = escapeScriptJson(toWebviewState(state));
  const graph = state.graph;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DCL Graph Workspace</title>
  <style nonce="${nonce}">
    html, body { height: 100%; margin: 0; padding: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); overflow: hidden; }
    .toolbar { box-sizing: border-box; min-height: 48px; display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 13px; overflow: hidden; }
    .toolbar label { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; color: var(--vscode-descriptionForeground); }
    .toolbar select, .toolbar button { border: 1px solid var(--vscode-button-border, transparent); border-radius: 3px; padding: 4px 8px; font: inherit; white-space: nowrap; }
    .toolbar select { max-width: 190px; background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border-color: var(--vscode-dropdown-border); }
    .toolbar button { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; }
    .toolbar button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .toolbar button.primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .toolbar button.primary:hover { background: var(--vscode-button-hoverBackground); }
    .toolbar-spacer { flex: 1 1 auto; }
    .counts { color: var(--vscode-descriptionForeground); white-space: nowrap; }
    .content { display: grid; grid-template-columns: minmax(0, 1fr) 290px; width: 100vw; height: calc(100vh - 48px); min-height: 0; }
    #graph { position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; }
    .empty-state { display: grid; place-items: center; height: 100%; padding: 24px; box-sizing: border-box; text-align: center; }
    .empty-state h1 { margin: 0 0 8px; font-size: 18px; font-weight: 600; }
    .empty-state p { max-width: 560px; margin: 0 0 16px; color: var(--vscode-descriptionForeground); line-height: 1.5; }
    .details { box-sizing: border-box; border-left: 1px solid var(--vscode-panel-border); padding: 14px; overflow: auto; background: var(--vscode-sideBar-background); color: var(--vscode-sideBar-foreground); font-size: 12px; line-height: 1.45; }
    .details-title { margin: 0 0 10px; font-size: 13px; font-weight: 600; color: var(--vscode-sideBarTitle-foreground); }
    .detail-row { margin: 0 0 10px; }
    .detail-label { display: block; margin-bottom: 2px; color: var(--vscode-descriptionForeground); font-size: 11px; text-transform: uppercase; }
    .detail-value { overflow-wrap: anywhere; }
    .empty-detail { color: var(--vscode-descriptionForeground); }
    .detail-actions { display: flex; flex-direction: column; gap: 6px; }
    .detail-actions button { width: 100%; text-align: left; border: 1px solid var(--vscode-button-border, transparent); border-radius: 3px; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); font: inherit; cursor: pointer; }
    .detail-actions button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .legend { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border); }
    .legend-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; }
    .legend-item { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .swatch { width: 11px; height: 11px; border-radius: 2px; flex: 0 0 auto; background: #4f6bed; border: 1px solid #9db0ff; }
    .swatch.capability { background: #2ea043; border-color: #7ee787; }
    .swatch.intent { background: #4f6bed; border-color: #9db0ff; }
    .swatch.outcome, .swatch.step { background: #3b82f6; border-color: #93c5fd; }
    .swatch.rule { background: #d29922; border-color: #f2cc60; }
    .swatch.effect { background: #db6d28; border-color: #ffa657; }
    .swatch.event { background: #1f9d8a; border-color: #64d8cb; }
    .swatch.policy, .swatch.lifecycle-transition, .swatch.terminal-step { background: #bf4b8a; border-color: #ff9ece; }
    .swatch.lifecycle { background: #8957e5; border-color: #d2a8ff; }
    .swatch.context { background: #2ea043; border-color: #7ee787; }
    .swatch.child-context { background: #1f9d8a; border-color: #64d8cb; }
    .swatch.external-context { background: #6e7681; border-color: #9da7b3; }
    .swatch.initial-step { background: #2ea043; border-color: #7ee787; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <header class="toolbar">
    <label for="graph-type">Graph
      <select id="graph-type">${optionsHtml(state.graphTypes, state.graphType)}</select>
    </label>
    <label id="subject-label" for="subject" class="${state.subjects.length ? "" : "hidden"}">Subject
      <select id="subject">${optionsHtml(state.subjects, state.subject)}</select>
    </label>
    <label id="detail-label-control" for="architecture-detail" class="${state.graphType === "architecture" ? "" : "hidden"}">Detail
      <select id="architecture-detail">${optionsHtml([
        { label: "Overview", value: "overview" },
        { label: "Detailed", value: "detailed" },
        { label: "Full", value: "full" },
      ], state.architectureDetailLevel)}</select>
    </label>
    <label id="layout-label-control" for="layout-mode" class="${state.graphType === "capability" && graph ? "" : "hidden"}">Layout
      <select id="layout-mode">
        <option value="default">Default</option>
        <option value="layered">Layered</option>
        <option value="radial">Radial</option>
      </select>
    </label>
    <span class="counts">${graph ? `${graph.nodes.length} nodes, ${graph.edges.length} relationships` : "No graph"}</span>
    <span class="toolbar-spacer"></span>
    <button id="refresh" type="button">Refresh</button>
    <button id="compile-workspace" class="primary" type="button">Compile Workspace</button>
    <button id="export-svg" type="button"${graph ? "" : " disabled"}>Export SVG</button>
    <button id="export-png" type="button"${graph ? "" : " disabled"}>Export PNG</button>
    <button id="fit-graph" type="button"${graph ? "" : " disabled"}>Fit</button>
    <button id="reset-layout" type="button"${graph ? "" : " disabled"}>Reset Layout</button>
    <button id="center-selection" type="button"${graph ? "" : " disabled"}>Center Selection</button>
  </header>
  <main class="content">
    <section id="graph" aria-label="DCL graph workspace">
      ${graph ? "" : `<div class="empty-state"><div><h1>${escapeHtml(state.emptyTitle ?? "No Graph Available")}</h1><p>${escapeHtml(state.emptyMessage ?? "Compile DCL or choose another graph subject.")}</p><button id="empty-compile" class="primary" type="button">Compile Workspace</button></div></div>`}
    </section>
    <aside class="details" aria-live="polite">
      <h2 class="details-title">Node Details</h2>
      <p id="details-empty" class="empty-detail">Select a node to inspect it.</p>
      <div id="details-content" class="hidden">
        <p class="detail-row"><span class="detail-label">Display Label</span><span id="detail-label" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Source Name</span><span id="detail-source-name" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Kind</span><span id="detail-kind" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Relationships</span><span id="detail-relationships" class="detail-value"></span></p>
        <div id="source-section" class="detail-row hidden"><span class="detail-label">Source</span><div class="detail-actions"><button id="open-source" type="button">Open Source</button></div></div>
        <div id="show-in-section" class="detail-row hidden"><span class="detail-label">Show In</span><div id="show-in-actions" class="detail-actions"></div></div>
      </div>
      <section class="legend">
        <h2 class="details-title">Legend</h2>
        <div class="legend-grid">${legendItemsHtml(graph)}</div>
      </section>
    </aside>
  </main>
  <script nonce="${nonce}" src="${cytoscapeUri}"></script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const workspaceState = ${stateJson};
    const graph = ${graphJson};
    const editorBackground = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';
    const graphTypeInput = document.getElementById('graph-type');
    const subjectInput = document.getElementById('subject');
    const detailInput = document.getElementById('architecture-detail');
    const layoutInput = document.getElementById('layout-mode');
    const nodeById = new Map((graph?.nodes || []).map((node) => [node.id, node]));
    const incomingByNode = new Map();
    const outgoingByNode = new Map();
    let cy;
    let lastSelectedNodeId;
    let layoutMode = 'default';

    for (const edge of graph?.edges || []) {
      if (!outgoingByNode.has(edge.source)) outgoingByNode.set(edge.source, []);
      if (!incomingByNode.has(edge.target)) incomingByNode.set(edge.target, []);
      outgoingByNode.get(edge.source).push(edge);
      incomingByNode.get(edge.target).push(edge);
    }

    graphTypeInput.addEventListener('change', () => postSelection());
    subjectInput?.addEventListener('change', () => postSelection());
    detailInput?.addEventListener('change', () => postSelection());
    layoutInput?.addEventListener('change', (event) => {
      layoutMode = event.target.value;
      runLayout(true);
    });
    document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
    document.getElementById('compile-workspace').addEventListener('click', () => vscode.postMessage({ type: 'compileWorkspace' }));
    document.getElementById('export-svg').addEventListener('click', () => exportGraph('svg'));
    document.getElementById('export-png').addEventListener('click', () => exportGraph('png'));
    document.getElementById('empty-compile')?.addEventListener('click', () => vscode.postMessage({ type: 'compileWorkspace' }));
    document.getElementById('open-source')?.addEventListener('click', () => {
      if (lastSelectedNodeId) vscode.postMessage({ type: 'revealSource', nodeId: lastSelectedNodeId });
    });
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message?.type === 'requestExport' && (message.format === 'svg' || message.format === 'png')) {
        exportGraph(message.format);
      }
      if (message?.type === 'focusNode' && typeof message.nodeId === 'string') {
        focusNode(message.nodeId);
      }
    });

    if (graph) {
      const elements = [
        ...graph.nodes.map((node) => ({ data: { id: node.id, label: node.label, kind: node.kind }, classes: node.kind })),
        ...graph.edges.map((edge) => ({ data: { id: edge.id, source: edge.source, target: edge.target, label: edge.label, kind: edge.kind } }))
      ];
      cy = cytoscape({
        container: document.getElementById('graph'),
        elements,
        layout: layoutOptions(),
        style: styleSheet(),
        minZoom: 0.25,
        maxZoom: 2.5,
        wheelSensitivity: 1.8,
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: false
      });
      document.getElementById('fit-graph').addEventListener('click', () => fitVisible());
      document.getElementById('reset-layout').addEventListener('click', () => runLayout(true));
      document.getElementById('center-selection').addEventListener('click', () => centerSelection());
      cy.on('tap', 'node', (event) => {
        const nodeId = event.target.id();
        lastSelectedNodeId = nodeId;
        updateDetails(nodeId);
        vscode.postMessage({ type: 'nodeSelected', nodeId });
      });
      cy.on('dbltap', 'node', (event) => {
        vscode.postMessage({ type: 'revealSource', nodeId: event.target.id() });
      });
      requestAnimationFrame(() => {
        fitVisible();
        if (workspaceState.focusNodeId) {
          window.setTimeout(() => focusNode(workspaceState.focusNodeId), 80);
        }
      });
    }

    function postSelection() {
      vscode.postMessage({
        type: 'selectionChanged',
        graphType: graphTypeInput.value,
        subject: subjectInput?.value,
        architectureDetailLevel: detailInput?.value
      });
    }

    function runLayout(fitAfter) {
      if (!cy) return;
      if (workspaceState.graphType === 'capability' && layoutMode === 'layered') {
        applyLayeredLayout();
        if (fitAfter) fitVisible();
        return;
      }
      cy.layout(layoutOptions()).run();
      if (fitAfter) window.setTimeout(() => fitVisible(), 100);
    }

    function layoutOptions() {
      if (workspaceState.graphType === 'capability' && layoutMode === 'radial') {
        const capabilityId = graph.nodes.find((node) => node.kind === 'capability')?.id;
        return { name: 'concentric', concentric: (node) => node.id() === capabilityId ? 3 : 1, levelWidth: () => 1, minNodeSpacing: 42, padding: 36, animate: false };
      }
      return { name: 'breadthfirst', directed: true, spacingFactor: 1.2, padding: 36, animate: false };
    }

    function applyLayeredLayout() {
      const visibleNodes = cy.nodes().filter((node) => node.visible());
      const capabilityId = graph.nodes.find((node) => node.kind === 'capability')?.id;
      const capability = capabilityId ? cy.getElementById(capabilityId) : cy.collection();
      const kindOrder = ['intent', 'outcome', 'rule', 'effect', 'event', 'policy', 'lifecycle'];
      const rowHeight = 118;
      const columnWidth = 160;
      const startY = -Math.floor(kindOrder.length / 2) * rowHeight;
      cy.batch(() => {
        if (capability.length) capability.position({ x: -240, y: 0 });
        kindOrder.forEach((kind, kindIndex) => {
          const nodes = visibleNodes.filter((node) => node.data('kind') === kind).sort((a, b) => String(a.data('label')).localeCompare(String(b.data('label'))) || a.id().localeCompare(b.id()));
          const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
          nodes.forEach((node, index) => node.position({ x: 40 + (index % columns) * columnWidth, y: startY + kindIndex * rowHeight + Math.floor(index / columns) * 74 }));
        });
      });
    }

    function fitVisible() {
      const visible = cy?.elements().filter((element) => element.visible());
      if (!visible?.length) return;
      cy.fit(visible, 72);
      if (visible.nodes().length <= 35 && cy.zoom() < 0.55) {
        cy.zoom(0.55);
        cy.center(visible);
      }
    }

    function centerSelection() {
      if (!cy) return;
      const nodeId = lastSelectedNodeId || graph.nodes.find((node) => ['capability', 'context', 'event', 'lifecycle'].includes(node.kind))?.id || graph.nodes[0]?.id;
      if (!nodeId) return;
      focusNode(nodeId);
    }

    function focusNode(nodeId) {
      if (!cy || !nodeId) return;
      const node = cy.getElementById(nodeId);
      if (node.length) {
        cy.nodes().unselect();
        cy.center(node);
        node.select();
        lastSelectedNodeId = nodeId;
        updateDetails(nodeId);
      }
    }

    function exportGraph(format) {
      if (!cy || !graph) {
        vscode.postMessage({ type: 'graphExportFailed', reason: 'No graph is currently visible.' });
        return;
      }

      try {
        if (format === 'png') {
          vscode.postMessage({
            type: 'graphExported',
            format,
            filename: workspaceState.exportBaseName + '.png',
            dataUri: cy.png({ full: false, bg: '#ffffff', scale: 2 })
          });
          return;
        }

        vscode.postMessage({
          type: 'graphExported',
          format: 'svg',
          filename: workspaceState.exportBaseName + '.svg',
          text: serializeSvg()
        });
      } catch (error) {
        vscode.postMessage({
          type: 'graphExportFailed',
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }

    function serializeSvg() {
      const width = Math.max(320, cy.width());
      const height = Math.max(220, cy.height());
      const edgeSvg = cy.edges().map((edge) => edgeSvgFor(edge)).join('');
      const nodeSvg = cy.nodes().map((node) => nodeSvgFor(node)).join('');
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.ceil(width) + '" height="' + Math.ceil(height) + '" viewBox="0 0 ' + Math.ceil(width) + ' ' + Math.ceil(height) + '">',
        '<defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 Z" fill="#6e7681"/></marker></defs>',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        '<g font-family="Inter, Segoe UI, Arial, sans-serif">',
        edgeSvg,
        nodeSvg,
        '</g>',
        '</svg>'
      ].join('');
    }

    function edgeSvgFor(edge) {
      const source = edge.source().renderedPosition();
      const target = edge.target().renderedPosition();
      const x1 = source.x;
      const y1 = source.y;
      const x2 = target.x;
      const y2 = target.y;
      const labelX = (x1 + x2) / 2;
      const labelY = (y1 + y2) / 2 - 6;
      return '<g>' +
        '<line x1="' + round(x1) + '" y1="' + round(y1) + '" x2="' + round(x2) + '" y2="' + round(y2) + '" stroke="#6e7681" stroke-width="1.6" marker-end="url(#arrow)"/>' +
        '<rect x="' + round(labelX - textWidth(edge.data('label'), 9) / 2 - 4) + '" y="' + round(labelY - 12) + '" width="' + round(textWidth(edge.data('label'), 9) + 8) + '" height="16" fill="#ffffff" opacity="0.9"/>' +
        '<text x="' + round(labelX) + '" y="' + round(labelY) + '" text-anchor="middle" font-size="9" fill="#57606a">' + xml(edge.data('label')) + '</text>' +
        '</g>';
    }

    function nodeSvgFor(node) {
      const position = node.renderedPosition();
      const width = node.renderedWidth() || Number(node.style('width')) || 122;
      const height = node.renderedHeight() || Number(node.style('height')) || 68;
      const x = position.x - width / 2;
      const y = position.y - height / 2;
      const colors = colorsFor(node.data('kind'));
      const rx = node.data('kind') === 'event' ? Math.min(width, height) / 2 : 8;
      const shape = node.data('kind') === 'event'
        ? '<ellipse cx="' + round(x + width / 2) + '" cy="' + round(y + height / 2) + '" rx="' + round(width / 2) + '" ry="' + round(height / 2) + '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="1.4"/>'
        : '<rect x="' + round(x) + '" y="' + round(y) + '" width="' + round(width) + '" height="' + round(height) + '" rx="' + round(rx) + '" fill="' + colors.fill + '" stroke="' + colors.stroke + '" stroke-width="1.4"/>';
      return '<g>' + shape + wrappedText(node.data('label'), x + width / 2, y + height / 2) + '</g>';
    }

    function wrappedText(label, centerX, centerY) {
      const words = String(label || '').split(/\\s+/).filter(Boolean);
      const lines = [];
      let current = '';
      for (const word of words) {
        const next = current ? current + ' ' + word : word;
        if (next.length > 16 && current) {
          lines.push(current);
          current = word;
        } else {
          current = next;
        }
      }
      if (current) lines.push(current);
      const visible = lines.slice(0, 4);
      const lineHeight = 13;
      const startY = centerY - ((visible.length - 1) * lineHeight) / 2 + 4;
      return '<text text-anchor="middle" font-size="11" font-weight="600" fill="#f6f8fa">' +
        visible.map((line, index) => '<tspan x="' + round(centerX) + '" y="' + round(startY + index * lineHeight) + '">' + xml(line) + '</tspan>').join('') +
        '</text>';
    }

    function colorsFor(kind) {
      const colors = {
        capability: ['#2ea043', '#7ee787'],
        context: ['#2ea043', '#7ee787'],
        'child-context': ['#1f9d8a', '#64d8cb'],
        event: ['#1f9d8a', '#64d8cb'],
        lifecycle: ['#8957e5', '#d2a8ff'],
        rule: ['#d29922', '#f2cc60'],
        effect: ['#db6d28', '#ffa657'],
        policy: ['#bf4b8a', '#ff9ece'],
        'lifecycle-transition': ['#bf4b8a', '#ff9ece'],
        'terminal-step': ['#bf4b8a', '#ff9ece'],
        'initial-step': ['#2ea043', '#7ee787'],
        'external-context': ['#6e7681', '#9da7b3']
      };
      const [fill, stroke] = colors[kind] || ['#4f6bed', '#9db0ff'];
      return { fill, stroke };
    }

    function textWidth(text, fontSize) {
      return String(text || '').length * fontSize * 0.56;
    }

    function round(value) {
      return Math.round(value * 100) / 100;
    }

    function xml(value) {
      return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function updateDetails(nodeId) {
      const node = nodeById.get(nodeId);
      if (!node) return;
      document.getElementById('details-empty').classList.add('hidden');
      document.getElementById('details-content').classList.remove('hidden');
      document.getElementById('detail-label').textContent = node.label;
      document.getElementById('detail-source-name').textContent = node.sourceName || node.label;
      document.getElementById('detail-kind').textContent = node.kind;
      document.getElementById('detail-relationships').textContent = relationshipSummary(nodeId);
      document.getElementById('source-section').classList.toggle('hidden', !node.hasSource);
      updateShowInActions(nodeId);
    }

    function updateShowInActions(nodeId) {
      const section = document.getElementById('show-in-section');
      const actions = document.getElementById('show-in-actions');
      const targets = workspaceState.graphSyncTargets?.[nodeId] || [];
      actions.replaceChildren();
      if (!targets.length) {
        section.classList.add('hidden');
        return;
      }

      section.classList.remove('hidden');
      for (const target of targets) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = target.label;
        button.addEventListener('click', () => {
          vscode.postMessage({
            type: 'showInGraph',
            graphType: target.graphType,
            subject: target.subject,
            architectureDetailLevel: target.architectureDetailLevel,
            focusIdentity: target.focusIdentity
          });
        });
        actions.appendChild(button);
      }
    }

    function relationshipSummary(nodeId) {
      const outgoing = outgoingByNode.get(nodeId) || [];
      const incoming = incomingByNode.get(nodeId) || [];
      const parts = [
        ...outgoing.map((edge) => edge.label + ' ' + labelFor(edge.target)),
        ...incoming.map((edge) => labelFor(edge.source) + ' ' + edge.label)
      ];
      return parts.length ? parts.join('; ') : 'No relationships';
    }

    function labelFor(nodeId) {
      return nodeById.get(nodeId)?.label || nodeId;
    }

    function styleSheet() {
      return [
        { selector: 'node', style: { 'label': 'data(label)', 'text-wrap': 'wrap', 'text-max-width': 118, 'text-overflow-wrap': 'anywhere', 'font-size': 11, 'color': '#d4d4d4', 'text-valign': 'center', 'text-halign': 'center', 'background-color': '#4f6bed', 'border-width': 1, 'border-color': '#9db0ff', 'width': 122, 'height': 68, 'shape': 'round-rectangle' } },
        { selector: 'node.capability, node.context, node.initial-step', style: { 'background-color': '#2ea043', 'border-color': '#7ee787', 'width': 138, 'height': 76, 'font-weight': 700 } },
        { selector: 'node.child-context, node.event', style: { 'background-color': '#1f9d8a', 'border-color': '#64d8cb' } },
        { selector: 'node.lifecycle', style: { 'background-color': '#8957e5', 'border-color': '#d2a8ff' } },
        { selector: 'node.rule', style: { 'background-color': '#d29922', 'border-color': '#f2cc60' } },
        { selector: 'node.effect', style: { 'background-color': '#db6d28', 'border-color': '#ffa657' } },
        { selector: 'node.policy, node.lifecycle-transition, node.terminal-step', style: { 'background-color': '#bf4b8a', 'border-color': '#ff9ece' } },
        { selector: 'node.external-context', style: { 'background-color': '#6e7681', 'border-color': '#9da7b3' } },
        { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#f2cc60', 'overlay-color': '#f2cc60', 'overlay-opacity': 0.16 } },
        { selector: 'edge', style: { 'label': 'data(label)', 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'line-color': '#6e7681', 'target-arrow-color': '#6e7681', 'font-size': 9, 'color': '#9da7b3', 'text-background-color': editorBackground, 'text-background-opacity': 1, 'text-background-padding': 2, 'width': 1.4 } },
        { selector: 'edge[kind *= "contains"], edge[kind = "begins"]', style: { 'line-style': 'dashed' } }
      ];
    }
  </script>
</body>
</html>`;
}

function renderEmptyHtml(title: string, message: string, canCompile: boolean): string {
  const nonce = nonceValue();
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>DCL Graph Workspace</title><style nonce="${nonce}">html, body { height: 100%; margin: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); }.toolbar { box-sizing: border-box; height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border-bottom: 1px solid var(--vscode-panel-border); }.toolbar-spacer { flex: 1; }button { border: 1px solid var(--vscode-button-border, transparent); border-radius: 3px; padding: 4px 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); font: inherit; cursor: pointer; }.empty-state { display: grid; place-items: center; height: calc(100vh - 48px); padding: 24px; box-sizing: border-box; text-align: center; }h1 { margin: 0 0 8px; font-size: 18px; }p { max-width: 560px; margin: 0 0 16px; color: var(--vscode-descriptionForeground); line-height: 1.5; }</style></head><body><header class="toolbar"><strong>DCL Graph Workspace</strong><span class="toolbar-spacer"></span><button id="refresh" type="button">Refresh</button><button id="compile-workspace" type="button"${canCompile ? "" : " disabled"}>Compile Workspace</button></header><main class="empty-state"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><button id="empty-compile" type="button"${canCompile ? "" : " disabled"}>Compile Workspace</button></div></main><script nonce="${nonce}">const vscode = acquireVsCodeApi();document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));document.getElementById('compile-workspace').addEventListener('click', () => vscode.postMessage({ type: 'compileWorkspace' }));document.getElementById('empty-compile').addEventListener('click', () => vscode.postMessage({ type: 'compileWorkspace' }));</script></body></html>`;
}

function isGraphWorkspaceMessage(message: unknown): message is GraphWorkspaceMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Partial<GraphWorkspaceMessage>;
  if (candidate.type === "refresh" || candidate.type === "compileWorkspace") return true;
  if (candidate.type === "graphExportFailed") return typeof candidate.reason === "string";
  if (candidate.type === "graphExported") {
    return (candidate.format === "svg" || candidate.format === "png")
      && typeof candidate.filename === "string"
      && (typeof candidate.text === "string" || typeof candidate.dataUri === "string");
  }
  if (candidate.type === "nodeSelected" || candidate.type === "revealSource") {
    return typeof candidate.nodeId === "string" && candidate.nodeId.trim() !== "";
  }
  if (candidate.type === "selectionChanged") {
    return isGraphWorkspaceType(candidate.graphType);
  }
  if (candidate.type === "showInGraph") {
    return isGraphWorkspaceType(candidate.graphType)
      && isSemanticIdentity(candidate.focusIdentity)
      && (candidate.subject === undefined || typeof candidate.subject === "string")
      && (
        candidate.architectureDetailLevel === undefined
        || candidate.architectureDetailLevel === "overview"
        || candidate.architectureDetailLevel === "detailed"
        || candidate.architectureDetailLevel === "full"
      );
  }
  return false;
}

function isGraphWorkspaceType(value: unknown): value is DclGraphWorkspaceType {
  return value === "architecture"
    || value === "capability"
    || value === "lifecycle"
    || value === "event-flow"
    || value === "context-map";
}

function isSemanticIdentity(value: unknown): value is DclSemanticIdentity {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DclSemanticIdentity>;
  return typeof candidate.name === "string"
    && candidate.name.trim() !== ""
    && (
      candidate.kind === "capability"
      || candidate.kind === "context"
      || candidate.kind === "event"
      || candidate.kind === "effect"
      || candidate.kind === "policy"
      || candidate.kind === "lifecycle"
      || candidate.kind === "lifecycle-step"
      || candidate.kind === "lifecycle-transition"
    );
}

function toWebviewGraph(graph: DclGraphModel): WebviewGraphModel {
  return {
    ...graph,
    nodes: graph.nodes.map(({ source, ...node }) => ({ ...node, hasSource: Boolean(source) })),
  };
}

function toWebviewState(state: DclGraphWorkspaceState): Omit<DclGraphWorkspaceState, "graph"> {
  const { graph: _graph, ...rest } = state;
  return rest;
}

function optionsHtml(options: Array<{ label: string; value: string }>, selected: string | undefined): string {
  return options
    .map((option) => `<option value="${escapeHtml(option.value)}"${option.value === selected ? " selected" : ""}>${escapeHtml(option.label)}</option>`)
    .join("");
}

function legendItemsHtml(graph: DclGraphModel | undefined): string {
  if (!graph) return "";
  return Array.from(new Set(graph.nodes.map((node) => node.kind)))
    .sort()
    .map((kind) => `<span class="legend-item"><span class="swatch ${escapeHtml(kind)}"></span>${escapeHtml(kind)}</span>`)
    .join("");
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nonceValue(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
