import * as vscode from "vscode";
import { DclGraphModel } from "../graphs/DclGraphModel";
import { DclGraphWorkspaceSelection, DclGraphWorkspaceState, DclGraphWorkspaceType } from "../graphs/DclGraphWorkspaceState";
import { revealSourceLocation } from "../source/DclSourceLocation";

type GraphWorkspaceMessage = {
  type: "selectionChanged";
  graphType: DclGraphWorkspaceType;
  subject?: string;
  architectureDetailLevel?: "overview" | "detailed" | "full";
} | {
  type: "nodeSelected";
  nodeId: string;
} | {
  type: "refresh";
} | {
  type: "compileWorkspace";
};

type WebviewGraphModel = Omit<DclGraphModel, "nodes"> & {
  nodes: Array<Omit<DclGraphModel["nodes"][number], "source">>;
};

type GraphWorkspaceCallbacks = {
  onSelectionChanged(selection: DclGraphWorkspaceSelection): void;
  onRefresh(): void;
  onCompileWorkspace(): void;
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
      DclGraphWorkspacePanel.currentPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "dclGraphWorkspace",
      "DCL Graph Workspace",
      vscode.ViewColumn.Beside,
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
      DclGraphWorkspacePanel.currentPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "dclGraphWorkspace",
      "DCL Graph Workspace",
      vscode.ViewColumn.Beside,
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

    if (message.type === "refresh") {
      DclGraphWorkspacePanel.callbacks?.onRefresh();
      return;
    }

    if (message.type === "compileWorkspace") {
      DclGraphWorkspacePanel.callbacks?.onCompileWorkspace();
      return;
    }

    const node = DclGraphWorkspacePanel.currentGraph?.nodes.find((item) => item.id === message.nodeId);
    if (!node) return;

    if (!node.source) {
      void vscode.window.showWarningMessage(`No source location is available for graph node '${node.sourceName ?? node.label}'.`);
      return;
    }

    const result = await revealSourceLocation(node.source, "oneBased");
    if (!result.ok) {
      void vscode.window.showWarningMessage(result.reason);
    }
  }
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
    document.getElementById('empty-compile')?.addEventListener('click', () => vscode.postMessage({ type: 'compileWorkspace' }));

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
      requestAnimationFrame(() => fitVisible());
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
      if (visible?.length) cy.fit(visible, 32);
    }

    function centerSelection() {
      if (!cy) return;
      const nodeId = lastSelectedNodeId || graph.nodes.find((node) => ['capability', 'context', 'event', 'lifecycle'].includes(node.kind))?.id || graph.nodes[0]?.id;
      if (!nodeId) return;
      const node = cy.getElementById(nodeId);
      if (node.length) {
        cy.center(node);
        node.select();
        updateDetails(nodeId);
      }
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
  if (candidate.type === "nodeSelected") return typeof candidate.nodeId === "string" && candidate.nodeId.trim() !== "";
  if (candidate.type !== "selectionChanged") return false;
  return candidate.graphType === "architecture"
    || candidate.graphType === "capability"
    || candidate.graphType === "lifecycle"
    || candidate.graphType === "event-flow"
    || candidate.graphType === "context-map";
}

function toWebviewGraph(graph: DclGraphModel): WebviewGraphModel {
  return {
    ...graph,
    nodes: graph.nodes.map(({ source: _source, ...node }) => node),
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
