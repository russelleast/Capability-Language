import * as vscode from "vscode";
import { ArchitectureOverviewDetailLevel, ArchitectureOverviewGraphSet } from "../graphs/DclArchitectureOverviewGraphBuilder";
import { DclGraphModel } from "../graphs/DclGraphModel";
import { revealSourceLocation } from "../source/DclSourceLocation";

type ArchitectureOverviewMessage = {
  type: "nodeSelected";
  detailLevel: ArchitectureOverviewDetailLevel;
  nodeId: string;
};

type WebviewGraphModel = Omit<DclGraphModel, "nodes"> & {
  nodes: Array<Omit<DclGraphModel["nodes"][number], "source">>;
};

type WebviewGraphSet = Record<ArchitectureOverviewDetailLevel, WebviewGraphModel>;

export class DclArchitectureOverviewGraphPanel {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static currentGraphs: ArchitectureOverviewGraphSet | undefined;

  static show(extensionUri: vscode.Uri, graphs: ArchitectureOverviewGraphSet): void {
    const title = "DCL Architecture Overview";

    if (DclArchitectureOverviewGraphPanel.currentPanel) {
      DclArchitectureOverviewGraphPanel.currentGraphs = graphs;
      DclArchitectureOverviewGraphPanel.currentPanel.title = title;
      DclArchitectureOverviewGraphPanel.currentPanel.webview.html = renderHtml(DclArchitectureOverviewGraphPanel.currentPanel.webview, extensionUri, graphs);
      DclArchitectureOverviewGraphPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "dclArchitectureOverview",
      title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "media"),
        ],
      },
    );

    DclArchitectureOverviewGraphPanel.currentPanel = panel;
    DclArchitectureOverviewGraphPanel.currentGraphs = graphs;
    panel.webview.html = renderHtml(panel.webview, extensionUri, graphs);
    panel.webview.onDidReceiveMessage((message: unknown) => {
      void DclArchitectureOverviewGraphPanel.handleMessage(message);
    });
    panel.onDidDispose(() => {
      DclArchitectureOverviewGraphPanel.currentPanel = undefined;
      DclArchitectureOverviewGraphPanel.currentGraphs = undefined;
    });
  }

  static showEmpty(extensionUri: vscode.Uri, title: string, message: string): void {
    if (DclArchitectureOverviewGraphPanel.currentPanel) {
      DclArchitectureOverviewGraphPanel.currentGraphs = undefined;
      DclArchitectureOverviewGraphPanel.currentPanel.title = title;
      DclArchitectureOverviewGraphPanel.currentPanel.webview.html = renderEmptyHtml(title, message);
      DclArchitectureOverviewGraphPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "dclArchitectureOverview",
      title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "media"),
        ],
      },
    );
    DclArchitectureOverviewGraphPanel.currentPanel = panel;
    DclArchitectureOverviewGraphPanel.currentGraphs = undefined;
    panel.webview.html = renderEmptyHtml(title, message);
    panel.webview.onDidReceiveMessage((message: unknown) => {
      void DclArchitectureOverviewGraphPanel.handleMessage(message);
    });
    panel.onDidDispose(() => {
      DclArchitectureOverviewGraphPanel.currentPanel = undefined;
      DclArchitectureOverviewGraphPanel.currentGraphs = undefined;
    });
  }

  private static async handleMessage(message: unknown): Promise<void> {
    if (!isArchitectureOverviewMessage(message)) return;

    const node = DclArchitectureOverviewGraphPanel.currentGraphs?.[message.detailLevel].nodes.find((item) => item.id === message.nodeId);
    if (!node) return;

    if (!node.source) {
      void vscode.window.showWarningMessage(`No source location is available for architecture node '${node.label}'.`);
      return;
    }

    const result = await revealSourceLocation(node.source, "oneBased");
    if (!result.ok) {
      void vscode.window.showWarningMessage(result.reason);
    }
  }
}

function renderHtml(webview: vscode.Webview, extensionUri: vscode.Uri, graphs: ArchitectureOverviewGraphSet): string {
  const nonce = nonceValue();
  const cytoscapeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "cytoscape.min.js"));
  const graphsJson = escapeScriptJson(toWebviewGraphSet(graphs));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DCL Architecture Overview</title>
  <style nonce="${nonce}">
    html, body { height: 100%; margin: 0; padding: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); overflow: hidden; }
    .toolbar { box-sizing: border-box; height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 13px; overflow: hidden; }
    .title { font-weight: 600; white-space: nowrap; }
    .subtitle { color: var(--vscode-descriptionForeground); white-space: nowrap; }
    .toolbar-spacer { flex: 1 1 auto; }
    .toolbar button, .toolbar select { border: 1px solid var(--vscode-button-border, transparent); border-radius: 3px; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); font: inherit; cursor: pointer; white-space: nowrap; }
    .toolbar button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .content { display: grid; grid-template-columns: minmax(0, 1fr) 290px; width: 100vw; height: calc(100vh - 44px); min-height: 0; }
    #graph { position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; }
    .graph-empty { position: absolute; left: 16px; bottom: 16px; z-index: 2; max-width: min(560px, calc(100% - 32px)); box-sizing: border-box; border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 10px 12px; background: var(--vscode-editorWidget-background); color: var(--vscode-descriptionForeground); box-shadow: 0 4px 14px rgb(0 0 0 / 18%); }
    .details { box-sizing: border-box; border-left: 1px solid var(--vscode-panel-border); padding: 14px; overflow: auto; background: var(--vscode-sideBar-background); color: var(--vscode-sideBar-foreground); font-size: 12px; line-height: 1.45; }
    .details-title { margin: 0 0 10px; font-size: 13px; font-weight: 600; color: var(--vscode-sideBarTitle-foreground); }
    .detail-row { margin: 0 0 10px; }
    .detail-label { display: block; margin-bottom: 2px; color: var(--vscode-descriptionForeground); font-size: 11px; text-transform: uppercase; }
    .detail-value { overflow-wrap: anywhere; }
    .empty-detail { color: var(--vscode-descriptionForeground); }
    .legend { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--vscode-panel-border); }
    .legend-item { display: flex; align-items: center; gap: 6px; margin: 8px 0; min-width: 0; }
    .swatch { width: 11px; height: 11px; border-radius: 2px; flex: 0 0 auto; background: #4f6bed; border: 1px solid #9db0ff; }
    .swatch.context { background: #2ea043; border-color: #7ee787; }
    .swatch.child-context { background: #1f9d8a; border-color: #64d8cb; }
    .swatch.external-context { background: #6e7681; border-color: #9da7b3; }
    .swatch.capability { background: #4f6bed; border-color: #9db0ff; }
    .swatch.event { background: #d29922; border-color: #f2cc60; }
    .swatch.lifecycle { background: #8957e5; border-color: #d2a8ff; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <header class="toolbar">
    <span class="title">DCL Architecture Overview</span>
    <span id="subtitle" class="subtitle"></span>
    <span class="toolbar-spacer"></span>
    <label>Detail <select id="detail-level"><option value="overview">Overview</option><option value="detailed">Detailed</option><option value="full">Full</option></select></label>
    <button id="fit-graph" type="button">Fit</button>
    <button id="reset-layout" type="button">Reset Layout</button>
    <button id="center-selection" type="button">Center Selection</button>
  </header>
  <main class="content">
    <section id="graph" aria-label="DCL architecture overview graph">
      <div id="graph-empty" class="graph-empty hidden"></div>
    </section>
    <aside class="details" aria-live="polite">
      <h2 class="details-title">Architecture Details</h2>
      <p id="details-empty" class="empty-detail">Select a context, capability, event, or lifecycle node to inspect it.</p>
      <div id="details-content" class="hidden">
        <p class="detail-row"><span class="detail-label">Label</span><span id="detail-label" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Kind</span><span id="detail-kind" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Context</span><span id="detail-context" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Capability Count</span><span id="detail-capability-count" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Event Count</span><span id="detail-event-count" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Lifecycle</span><span id="detail-lifecycle" class="detail-value"></span></p>
      </div>
      <section class="legend">
        <h2 class="details-title">Legend</h2>
        <div id="legend-items"></div>
      </section>
    </aside>
  </main>
  <script nonce="${nonce}" src="${cytoscapeUri}"></script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const graphs = ${graphsJson};
    let detailLevel = 'overview';
    let cy;
    let lastSelectedNodeId;
    const editorBackground = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';

    document.getElementById('detail-level').addEventListener('change', (event) => {
      detailLevel = event.target.value;
      lastSelectedNodeId = undefined;
      renderGraph();
    });
    document.getElementById('fit-graph').addEventListener('click', () => fitVisible());
    document.getElementById('reset-layout').addEventListener('click', () => runLayout(true));
    document.getElementById('center-selection').addEventListener('click', () => centerSelection());

    renderGraph();

    function renderGraph() {
      const graph = graphs[detailLevel];
      document.getElementById('subtitle').textContent = graph.nodes.length + ' nodes, ' + graph.edges.length + ' relationships';
      document.getElementById('legend-items').innerHTML = legendHtml(graph);
      updateEmptyState(graph);
      const elements = [
        ...graph.nodes.map((node) => ({ data: { id: node.id, label: node.label, kind: node.kind }, classes: node.kind })),
        ...graph.edges.map((edge) => ({ data: { id: edge.id, source: edge.source, target: edge.target, label: edge.label, kind: edge.kind } }))
      ];
      if (cy) cy.destroy();
      cy = cytoscape({
        container: document.getElementById('graph'),
        elements,
        layout: { name: 'breadthfirst', directed: true, spacingFactor: 1.15, padding: 30 },
        style: [
          { selector: 'node', style: { 'label': 'data(label)', 'text-wrap': 'wrap', 'text-max-width': 150, 'font-size': 11, 'color': '#d4d4d4', 'text-valign': 'center', 'text-halign': 'center', 'background-color': '#4f6bed', 'border-width': 1, 'border-color': '#9db0ff', 'width': 112, 'height': 48, 'shape': 'round-rectangle' } },
          { selector: 'node.context', style: { 'background-color': '#2ea043', 'border-color': '#7ee787', 'width': 126, 'height': 54, 'font-weight': 700 } },
          { selector: 'node.child-context', style: { 'background-color': '#1f9d8a', 'border-color': '#64d8cb' } },
          { selector: 'node.external-context', style: { 'background-color': '#6e7681', 'border-color': '#9da7b3' } },
          { selector: 'node.event', style: { 'background-color': '#d29922', 'border-color': '#f2cc60', 'shape': 'ellipse' } },
          { selector: 'node.lifecycle', style: { 'background-color': '#8957e5', 'border-color': '#d2a8ff' } },
          { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#f2cc60', 'overlay-color': '#f2cc60', 'overlay-opacity': 0.16 } },
          { selector: 'edge', style: { 'label': 'data(label)', 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'line-color': '#6e7681', 'target-arrow-color': '#6e7681', 'font-size': 9, 'color': '#9da7b3', 'text-background-color': editorBackground, 'text-background-opacity': 1, 'text-background-padding': 2, 'width': 1.4 } },
          { selector: 'edge[kind = "contains-context"], edge[kind = "contains-capability"]', style: { 'line-style': 'dashed' } }
        ],
        userZoomingEnabled: true,
        userPanningEnabled: true,
        boxSelectionEnabled: false
      });
      cy.on('tap', 'node', (event) => {
        const nodeId = event.target.id();
        lastSelectedNodeId = nodeId;
        updateDetails(nodeId);
        vscode.postMessage({ type: 'nodeSelected', detailLevel, nodeId });
      });
      requestAnimationFrame(() => fitVisible());
      document.getElementById('details-empty').classList.remove('hidden');
      document.getElementById('details-content').classList.add('hidden');
    }

    function runLayout(fitAfter) {
      cy.layout({ name: 'breadthfirst', directed: true, spacingFactor: 1.15, padding: 30 }).run();
      if (fitAfter) window.setTimeout(() => fitVisible(), 80);
    }
    function fitVisible() {
      const visible = cy.elements().filter((element) => element.visible());
      if (visible.length) cy.fit(visible, 32);
    }
    function centerSelection() {
      const nodeId = lastSelectedNodeId || graphs[detailLevel].nodes.find((node) => node.kind === 'context' || node.kind === 'capability')?.id;
      if (!nodeId) return;
      const node = cy.getElementById(nodeId);
      if (node.length) {
        cy.center(node);
        node.select();
        updateDetails(nodeId);
      }
    }
    function updateDetails(nodeId) {
      const graph = graphs[detailLevel];
      const node = graph.nodes.find((item) => item.id === nodeId);
      if (!node) return;
      document.getElementById('details-empty').classList.add('hidden');
      document.getElementById('details-content').classList.remove('hidden');
      document.getElementById('detail-label').textContent = node.label;
      document.getElementById('detail-kind').textContent = node.kind;
      document.getElementById('detail-context').textContent = contextFor(graph, nodeId);
      document.getElementById('detail-capability-count').textContent = String(graph.edges.filter((edge) => edge.kind === 'contains-capability' && edge.source === nodeId).length);
      document.getElementById('detail-event-count').textContent = String(graph.edges.filter((edge) => edge.kind === 'emits' && edge.source === nodeId).length);
      document.getElementById('detail-lifecycle').textContent = graph.edges.some((edge) => edge.kind === 'has-lifecycle' && edge.source === nodeId) || node.kind === 'lifecycle' ? 'Present' : 'Absent';
    }
    function contextFor(graph, nodeId) {
      const parent = graph.edges.find((edge) => edge.kind === 'contains-capability' && edge.target === nodeId);
      if (!parent) return 'Not applicable';
      return graph.nodes.find((node) => node.id === parent.source)?.label || parent.source;
    }
    function updateEmptyState(graph) {
      const empty = document.getElementById('graph-empty');
      const hasEvents = graph.nodes.some((node) => node.kind === 'event');
      const hasLifecycles = graph.nodes.some((node) => node.kind === 'lifecycle');
      const message = detailLevel === 'detailed' && !hasEvents
        ? 'Detailed view selected, but the compiled summary does not include event data.'
        : detailLevel === 'full' && !hasLifecycles
          ? 'Full view selected, but the compiled summary does not include lifecycle data.'
          : '';
      empty.textContent = message;
      empty.classList.toggle('hidden', !message);
    }
    function legendHtml(graph) {
      const kinds = Array.from(new Set(graph.nodes.map((node) => node.kind)));
      return kinds.map((kind) => '<span class="legend-item"><span class="swatch ' + kind + '"></span>' + kind + '</span>').join('');
    }
  </script>
</body>
</html>`;
}

function renderEmptyHtml(title: string, message: string): string {
  const nonce = nonceValue();
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title><style nonce="${nonce}">html, body { height: 100%; margin: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); }.empty-state { display: grid; place-items: center; height: 100%; padding: 24px; box-sizing: border-box; text-align: center; }h1 { margin: 0 0 8px; font-size: 18px; font-weight: 600; }p { max-width: 520px; margin: 0; color: var(--vscode-descriptionForeground); line-height: 1.5; }</style></head><body><main class="empty-state"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></main></body></html>`;
}

function isArchitectureOverviewMessage(message: unknown): message is ArchitectureOverviewMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Partial<ArchitectureOverviewMessage>;
  return candidate.type === "nodeSelected"
    && isDetailLevel(candidate.detailLevel)
    && typeof candidate.nodeId === "string"
    && candidate.nodeId.trim() !== "";
}

function isDetailLevel(value: unknown): value is ArchitectureOverviewDetailLevel {
  return value === "overview" || value === "detailed" || value === "full";
}

function toWebviewGraphSet(graphs: ArchitectureOverviewGraphSet): WebviewGraphSet {
  return {
    overview: toWebviewGraph(graphs.overview),
    detailed: toWebviewGraph(graphs.detailed),
    full: toWebviewGraph(graphs.full),
  };
}

function toWebviewGraph(graph: DclGraphModel): WebviewGraphModel {
  return {
    ...graph,
    nodes: graph.nodes.map(({ source: _source, ...node }) => node),
  };
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
