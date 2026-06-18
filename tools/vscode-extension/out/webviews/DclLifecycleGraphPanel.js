"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DclLifecycleGraphPanel = void 0;
const vscode = __importStar(require("vscode"));
const DclSourceLocation_1 = require("../source/DclSourceLocation");
class DclLifecycleGraphPanel {
    static show(extensionUri, graph) {
        const title = graph.title || "DCL Lifecycle Graph";
        if (DclLifecycleGraphPanel.currentPanel) {
            DclLifecycleGraphPanel.currentGraph = graph;
            DclLifecycleGraphPanel.currentPanel.title = title;
            DclLifecycleGraphPanel.currentPanel.webview.html = renderHtml(DclLifecycleGraphPanel.currentPanel.webview, extensionUri, graph);
            DclLifecycleGraphPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
            return;
        }
        const panel = vscode.window.createWebviewPanel("dclLifecycleGraph", title, vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, "media"),
            ],
        });
        DclLifecycleGraphPanel.currentPanel = panel;
        DclLifecycleGraphPanel.currentGraph = graph;
        panel.webview.html = renderHtml(panel.webview, extensionUri, graph);
        panel.webview.onDidReceiveMessage((message) => {
            void DclLifecycleGraphPanel.handleMessage(message);
        });
        panel.onDidDispose(() => {
            DclLifecycleGraphPanel.currentPanel = undefined;
            DclLifecycleGraphPanel.currentGraph = undefined;
        });
    }
    static showEmpty(extensionUri, title, message) {
        if (DclLifecycleGraphPanel.currentPanel) {
            DclLifecycleGraphPanel.currentGraph = undefined;
            DclLifecycleGraphPanel.currentPanel.title = title;
            DclLifecycleGraphPanel.currentPanel.webview.html = renderEmptyHtml(title, message);
            DclLifecycleGraphPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
            return;
        }
        const panel = vscode.window.createWebviewPanel("dclLifecycleGraph", title, vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, "media"),
            ],
        });
        DclLifecycleGraphPanel.currentPanel = panel;
        DclLifecycleGraphPanel.currentGraph = undefined;
        panel.webview.html = renderEmptyHtml(title, message);
        panel.webview.onDidReceiveMessage((message) => {
            void DclLifecycleGraphPanel.handleMessage(message);
        });
        panel.onDidDispose(() => {
            DclLifecycleGraphPanel.currentPanel = undefined;
            DclLifecycleGraphPanel.currentGraph = undefined;
        });
    }
    static async handleMessage(message) {
        if (!isLifecycleGraphMessage(message))
            return;
        const node = DclLifecycleGraphPanel.currentGraph?.nodes.find((item) => item.id === message.nodeId);
        if (!node)
            return;
        if (!node.source) {
            void vscode.window.showWarningMessage(`No source location is available for lifecycle node '${node.label}'.`);
            return;
        }
        const result = await (0, DclSourceLocation_1.revealSourceLocation)(node.source, "oneBased");
        if (!result.ok) {
            void vscode.window.showWarningMessage(result.reason);
        }
    }
}
exports.DclLifecycleGraphPanel = DclLifecycleGraphPanel;
function renderHtml(webview, extensionUri, graph) {
    const nonce = nonceValue();
    const cytoscapeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "cytoscape.min.js"));
    const graphJson = escapeScriptJson(toWebviewGraph(graph));
    const hasTransitions = graph.edges.some((edge) => edge.kind === "transition");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(graph.title)}</title>
  <style nonce="${nonce}">
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      overflow: hidden;
    }

    .toolbar {
      box-sizing: border-box;
      height: 44px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 13px;
      overflow: hidden;
    }

    .title {
      font-weight: 600;
      white-space: nowrap;
    }

    .subtitle {
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
    }

    .toolbar-spacer {
      flex: 1 1 auto;
    }

    .toolbar button {
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 3px;
      padding: 4px 8px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      font: inherit;
      cursor: pointer;
      white-space: nowrap;
    }

    .toolbar button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .content {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 260px;
      width: 100vw;
      height: calc(100vh - 44px);
      min-height: 0;
    }

    #graph {
      position: relative;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
    }

    .graph-empty {
      position: absolute;
      left: 16px;
      bottom: 16px;
      z-index: 2;
      max-width: min(460px, calc(100% - 32px));
      box-sizing: border-box;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 10px 12px;
      background: var(--vscode-editorWidget-background);
      color: var(--vscode-descriptionForeground);
      box-shadow: 0 4px 14px rgb(0 0 0 / 18%);
    }

    .details {
      box-sizing: border-box;
      border-left: 1px solid var(--vscode-panel-border);
      padding: 14px;
      overflow: auto;
      background: var(--vscode-sideBar-background);
      color: var(--vscode-sideBar-foreground);
      font-size: 12px;
      line-height: 1.45;
    }

    .details-title {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-sideBarTitle-foreground);
    }

    .detail-row {
      margin: 0 0 10px;
    }

    .detail-label {
      display: block;
      margin-bottom: 2px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-transform: uppercase;
    }

    .detail-value {
      overflow-wrap: anywhere;
    }

    .empty-detail {
      color: var(--vscode-descriptionForeground);
    }

    .legend {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 8px 0;
      min-width: 0;
    }

    .swatch {
      width: 11px;
      height: 11px;
      border-radius: 2px;
      flex: 0 0 auto;
      background: #4f6bed;
      border: 1px solid #9db0ff;
    }

    .swatch.lifecycle { background: #8957e5; border-color: #d2a8ff; }
    .swatch.initial-step { background: #2ea043; border-color: #7ee787; }
    .swatch.step { background: #4f6bed; border-color: #9db0ff; }
    .swatch.terminal-step { background: #bf4b8a; border-color: #ff9ece; }

    .hidden {
      display: none;
    }

    @media (max-width: 720px) {
      .content {
        grid-template-columns: 1fr;
        grid-template-rows: minmax(0, 1fr) 148px;
      }

      .details {
        border-left: 0;
        border-top: 1px solid var(--vscode-panel-border);
      }
    }
  </style>
</head>
<body>
  <header class="toolbar">
    <span class="title">${escapeHtml(graph.title)}</span>
    <span class="subtitle">${graph.nodes.length} nodes, ${graph.edges.length} relationships</span>
    <span class="toolbar-spacer"></span>
    <button id="fit-graph" type="button">Fit</button>
    <button id="reset-layout" type="button">Reset Layout</button>
    <button id="center-lifecycle" type="button">Center Lifecycle</button>
  </header>
  <main class="content">
    <section id="graph" aria-label="DCL lifecycle graph">
      <div id="graph-empty" class="graph-empty${hasTransitions ? " hidden" : ""}">This lifecycle has no transitions in the compiled summary yet. Known lifecycle steps are still shown.</div>
    </section>
    <aside class="details" aria-live="polite">
      <h2 class="details-title">Node Details</h2>
      <p id="details-empty" class="empty-detail">Select a lifecycle node to inspect it.</p>
      <div id="details-content" class="hidden">
        <p class="detail-row">
          <span class="detail-label">Name</span>
          <span id="detail-label" class="detail-value"></span>
        </p>
        <p class="detail-row">
          <span class="detail-label">Kind</span>
          <span id="detail-kind" class="detail-value"></span>
        </p>
        <p class="detail-row">
          <span class="detail-label">Incoming Transitions</span>
          <span id="detail-incoming" class="detail-value"></span>
        </p>
        <p class="detail-row">
          <span class="detail-label">Outgoing Transitions</span>
          <span id="detail-outgoing" class="detail-value"></span>
        </p>
      </div>
      <section class="legend">
        <h2 class="details-title">Legend</h2>
        <span class="legend-item"><span class="swatch lifecycle"></span>lifecycle</span>
        <span class="legend-item"><span class="swatch initial-step"></span>initial step</span>
        <span class="legend-item"><span class="swatch step"></span>step</span>
        <span class="legend-item"><span class="swatch terminal-step"></span>terminal step</span>
      </section>
    </aside>
  </main>
  <script nonce="${nonce}" src="${cytoscapeUri}"></script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const graph = ${graphJson};
    const editorBackground = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const lifecycleNodeId = graph.nodes.find((node) => node.kind === 'lifecycle')?.id;
    const incomingTransitionsByNode = new Map();
    const outgoingTransitionsByNode = new Map();

    for (const edge of graph.edges) {
      if (edge.kind !== 'transition') continue;
      if (!outgoingTransitionsByNode.has(edge.source)) outgoingTransitionsByNode.set(edge.source, []);
      if (!incomingTransitionsByNode.has(edge.target)) incomingTransitionsByNode.set(edge.target, []);
      outgoingTransitionsByNode.get(edge.source).push(edge);
      incomingTransitionsByNode.get(edge.target).push(edge);
    }

    const elements = [
      ...graph.nodes.map((node) => ({
        data: { id: node.id, label: node.label, kind: node.kind },
        classes: node.kind
      })),
      ...graph.edges.map((edge) => ({
        data: { id: edge.id, source: edge.source, target: edge.target, label: edge.label, kind: edge.kind }
      }))
    ];

    const cy = cytoscape({
      container: document.getElementById('graph'),
      elements,
      layout: {
        name: 'breadthfirst',
        directed: true,
        roots: lifecycleNodeId ? [lifecycleNodeId] : undefined,
        spacingFactor: 1.2,
        padding: 30
      },
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-wrap': 'wrap',
            'text-max-width': 150,
            'font-size': 11,
            'color': '#d4d4d4',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#4f6bed',
            'border-width': 1,
            'border-color': '#9db0ff',
            'width': 92,
            'height': 44,
            'shape': 'round-rectangle'
          }
        },
        {
          selector: 'node.lifecycle',
          style: {
            'background-color': '#8957e5',
            'border-color': '#d2a8ff',
            'width': 138,
            'height': 58,
            'font-weight': 700
          }
        },
        {
          selector: 'node.initial-step',
          style: {
            'background-color': '#2ea043',
            'border-color': '#7ee787'
          }
        },
        {
          selector: 'node.terminal-step',
          style: {
            'background-color': '#bf4b8a',
            'border-color': '#ff9ece',
            'shape': 'round-octagon'
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#f2cc60',
            'overlay-color': '#f2cc60',
            'overlay-opacity': 0.16
          }
        },
        {
          selector: 'edge',
          style: {
            'label': 'data(label)',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'line-color': '#6e7681',
            'target-arrow-color': '#6e7681',
            'font-size': 9,
            'color': '#9da7b3',
            'text-background-color': editorBackground,
            'text-background-opacity': 1,
            'text-background-padding': 2,
            'width': 1.4
          }
        },
        {
          selector: 'edge[kind = "begins"]',
          style: {
            'line-style': 'dashed',
            'label': ''
          }
        }
      ],
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false
    });

    document.getElementById('fit-graph').addEventListener('click', () => fitVisible());
    document.getElementById('reset-layout').addEventListener('click', () => runLayout(true));
    document.getElementById('center-lifecycle').addEventListener('click', () => centerLifecycle());

    cy.on('tap', 'node', (event) => {
      const node = event.target;
      const nodeId = node.id();
      updateDetails(nodeId);
      vscode.postMessage({ type: 'nodeSelected', nodeId });
    });

    requestAnimationFrame(() => fitVisible());

    function runLayout(fitAfter) {
      cy.layout({
        name: 'breadthfirst',
        directed: true,
        roots: lifecycleNodeId ? [lifecycleNodeId] : undefined,
        spacingFactor: 1.2,
        padding: 30
      }).run();
      if (fitAfter) window.setTimeout(() => fitVisible(), 80);
    }

    function fitVisible() {
      const visible = cy.elements().filter((element) => element.visible());
      if (visible.length) cy.fit(visible, 32);
    }

    function centerLifecycle() {
      if (!lifecycleNodeId) return;
      const node = cy.getElementById(lifecycleNodeId);
      if (node.length) {
        cy.center(node);
        node.select();
        updateDetails(lifecycleNodeId);
      }
    }

    function updateDetails(nodeId) {
      const node = nodeById.get(nodeId);
      if (!node) return;

      document.getElementById('details-empty').classList.add('hidden');
      document.getElementById('details-content').classList.remove('hidden');
      document.getElementById('detail-label').textContent = node.label;
      document.getElementById('detail-kind').textContent = node.kind;
      document.getElementById('detail-incoming').textContent = String((incomingTransitionsByNode.get(nodeId) || []).length);
      document.getElementById('detail-outgoing').textContent = String((outgoingTransitionsByNode.get(nodeId) || []).length);
    }
  </script>
</body>
</html>`;
}
function renderEmptyHtml(title, message) {
    const nonce = nonceValue();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style nonce="${nonce}">
    html, body {
      height: 100%;
      margin: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
    }

    .empty-state {
      display: grid;
      place-items: center;
      height: 100%;
      padding: 24px;
      box-sizing: border-box;
      text-align: center;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 600;
    }

    p {
      max-width: 520px;
      margin: 0;
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <main class="empty-state">
    <div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </div>
  </main>
</body>
</html>`;
}
function isLifecycleGraphMessage(message) {
    if (!message || typeof message !== "object")
        return false;
    const candidate = message;
    return candidate.type === "nodeSelected" && typeof candidate.nodeId === "string" && candidate.nodeId.trim() !== "";
}
function toWebviewGraph(graph) {
    return {
        ...graph,
        nodes: graph.nodes.map(({ source: _source, ...node }) => node),
    };
}
function escapeScriptJson(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c");
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function nonceValue() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let text = "";
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
//# sourceMappingURL=DclLifecycleGraphPanel.js.map