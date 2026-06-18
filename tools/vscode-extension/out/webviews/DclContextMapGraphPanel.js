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
exports.DclContextMapGraphPanel = void 0;
const vscode = __importStar(require("vscode"));
const DclSourceLocation_1 = require("../source/DclSourceLocation");
class DclContextMapGraphPanel {
    static show(extensionUri, graph, selectedContext) {
        const title = graph.title || "DCL Context Map";
        if (DclContextMapGraphPanel.currentPanel) {
            DclContextMapGraphPanel.currentGraph = graph;
            DclContextMapGraphPanel.currentPanel.title = title;
            DclContextMapGraphPanel.currentPanel.webview.html = renderHtml(DclContextMapGraphPanel.currentPanel.webview, extensionUri, graph, selectedContext);
            DclContextMapGraphPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
            return;
        }
        const panel = vscode.window.createWebviewPanel("dclContextMap", title, vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, "media"),
            ],
        });
        DclContextMapGraphPanel.currentPanel = panel;
        DclContextMapGraphPanel.currentGraph = graph;
        panel.webview.html = renderHtml(panel.webview, extensionUri, graph, selectedContext);
        panel.webview.onDidReceiveMessage((message) => {
            void DclContextMapGraphPanel.handleMessage(message);
        });
        panel.onDidDispose(() => {
            DclContextMapGraphPanel.currentPanel = undefined;
            DclContextMapGraphPanel.currentGraph = undefined;
        });
    }
    static showEmpty(extensionUri, title, message) {
        if (DclContextMapGraphPanel.currentPanel) {
            DclContextMapGraphPanel.currentGraph = undefined;
            DclContextMapGraphPanel.currentPanel.title = title;
            DclContextMapGraphPanel.currentPanel.webview.html = renderEmptyHtml(title, message);
            DclContextMapGraphPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
            return;
        }
        const panel = vscode.window.createWebviewPanel("dclContextMap", title, vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, "media"),
            ],
        });
        DclContextMapGraphPanel.currentPanel = panel;
        DclContextMapGraphPanel.currentGraph = undefined;
        panel.webview.html = renderEmptyHtml(title, message);
        panel.webview.onDidReceiveMessage((message) => {
            void DclContextMapGraphPanel.handleMessage(message);
        });
        panel.onDidDispose(() => {
            DclContextMapGraphPanel.currentPanel = undefined;
            DclContextMapGraphPanel.currentGraph = undefined;
        });
    }
    static async handleMessage(message) {
        if (!isContextMapMessage(message))
            return;
        const node = DclContextMapGraphPanel.currentGraph?.nodes.find((item) => item.id === message.nodeId);
        if (!node)
            return;
        if (!node.source) {
            void vscode.window.showWarningMessage(`No source location is available for context map node '${node.label}'.`);
            return;
        }
        const result = await (0, DclSourceLocation_1.revealSourceLocation)(node.source, "oneBased");
        if (!result.ok) {
            void vscode.window.showWarningMessage(result.reason);
        }
    }
}
exports.DclContextMapGraphPanel = DclContextMapGraphPanel;
function renderHtml(webview, extensionUri, graph, selectedContext) {
    const nonce = nonceValue();
    const cytoscapeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "cytoscape.min.js"));
    const graphJson = escapeScriptJson(toWebviewGraph(graph));
    const selectedContextId = selectedContext ? nodeId("context", selectedContext) : undefined;
    const hasEdges = graph.edges.length > 0;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(graph.title)}</title>
  <style nonce="${nonce}">
    html, body { height: 100%; margin: 0; padding: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); overflow: hidden; }
    .toolbar { box-sizing: border-box; height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 13px; overflow: hidden; }
    .title { font-weight: 600; white-space: nowrap; }
    .subtitle { color: var(--vscode-descriptionForeground); white-space: nowrap; }
    .toolbar-spacer { flex: 1 1 auto; }
    .toolbar button { border: 1px solid var(--vscode-button-border, transparent); border-radius: 3px; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); font: inherit; cursor: pointer; white-space: nowrap; }
    .toolbar button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .content { display: grid; grid-template-columns: minmax(0, 1fr) 280px; width: 100vw; height: calc(100vh - 44px); min-height: 0; }
    #graph { position: relative; width: 100%; height: 100%; min-width: 0; min-height: 0; }
    .graph-empty { position: absolute; left: 16px; bottom: 16px; z-index: 2; max-width: min(520px, calc(100% - 32px)); box-sizing: border-box; border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 10px 12px; background: var(--vscode-editorWidget-background); color: var(--vscode-descriptionForeground); box-shadow: 0 4px 14px rgb(0 0 0 / 18%); }
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
    .hidden { display: none; }
  </style>
</head>
<body>
  <header class="toolbar">
    <span class="title">${escapeHtml(graph.title)}</span>
    <span class="subtitle">${graph.nodes.length} nodes, ${graph.edges.length} relationships</span>
    <span class="toolbar-spacer"></span>
    <button id="fit-graph" type="button">Fit</button>
    <button id="reset-layout" type="button">Reset Layout</button>
    <button id="center-context" type="button">Center Selected Context</button>
  </header>
  <main class="content">
    <section id="graph" aria-label="DCL context map graph">
      <div class="graph-empty${hasEdges ? " hidden" : ""}">Selected context has no explicit dependencies or children in the compiled summary.</div>
    </section>
    <aside class="details" aria-live="polite">
      <h2 class="details-title">Context Details</h2>
      <p id="details-empty" class="empty-detail">Select a context to inspect it.</p>
      <div id="details-content" class="hidden">
        <p class="detail-row"><span class="detail-label">Context Name</span><span id="detail-label" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Kind</span><span id="detail-kind" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Parent Context</span><span id="detail-parent" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Child Count</span><span id="detail-children" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Dependency Count</span><span id="detail-dependencies" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Dependent Count</span><span id="detail-dependents" class="detail-value"></span></p>
      </div>
      <section class="legend">
        <h2 class="details-title">Legend</h2>
        <span class="legend-item"><span class="swatch context"></span>context</span>
        <span class="legend-item"><span class="swatch child-context"></span>child context</span>
        <span class="legend-item"><span class="swatch external-context"></span>external/missing context reference</span>
      </section>
    </aside>
  </main>
  <script nonce="${nonce}" src="${cytoscapeUri}"></script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const graph = ${graphJson};
    const selectedContextId = ${escapeScriptJson(selectedContextId)};
    const editorBackground = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const parentByNode = new Map();
    const childCountByNode = new Map();
    const dependencyCountByNode = new Map();
    const dependentCountByNode = new Map();
    for (const edge of graph.edges) {
      if (edge.kind === 'contains') {
        parentByNode.set(edge.target, labelFor(edge.source));
        childCountByNode.set(edge.source, (childCountByNode.get(edge.source) || 0) + 1);
      }
      if (edge.kind === 'depends-on') {
        dependencyCountByNode.set(edge.source, (dependencyCountByNode.get(edge.source) || 0) + 1);
        dependentCountByNode.set(edge.target, (dependentCountByNode.get(edge.target) || 0) + 1);
      }
    }
    const elements = [
      ...graph.nodes.map((node) => ({ data: { id: node.id, label: node.label, kind: node.kind }, classes: node.kind })),
      ...graph.edges.map((edge) => ({ data: { id: edge.id, source: edge.source, target: edge.target, label: edge.label, kind: edge.kind } }))
    ];
    const cy = cytoscape({
      container: document.getElementById('graph'),
      elements,
      layout: { name: 'breadthfirst', directed: true, spacingFactor: 1.2, padding: 30 },
      style: [
        { selector: 'node', style: { 'label': 'data(label)', 'text-wrap': 'wrap', 'text-max-width': 150, 'font-size': 11, 'color': '#d4d4d4', 'text-valign': 'center', 'text-halign': 'center', 'background-color': '#2ea043', 'border-width': 1, 'border-color': '#7ee787', 'width': 118, 'height': 52, 'shape': 'round-rectangle' } },
        { selector: 'node.child-context', style: { 'background-color': '#1f9d8a', 'border-color': '#64d8cb' } },
        { selector: 'node.external-context', style: { 'background-color': '#6e7681', 'border-color': '#9da7b3', 'line-style': 'dashed' } },
        { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#f2cc60', 'overlay-color': '#f2cc60', 'overlay-opacity': 0.16 } },
        { selector: 'edge', style: { 'label': 'data(label)', 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'line-color': '#6e7681', 'target-arrow-color': '#6e7681', 'font-size': 9, 'color': '#9da7b3', 'text-background-color': editorBackground, 'text-background-opacity': 1, 'text-background-padding': 2, 'width': 1.4 } },
        { selector: 'edge[kind = "contains"]', style: { 'line-style': 'dashed' } }
      ],
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false
    });
    document.getElementById('fit-graph').addEventListener('click', () => fitVisible());
    document.getElementById('reset-layout').addEventListener('click', () => runLayout(true));
    document.getElementById('center-context').addEventListener('click', () => centerContext());
    cy.on('tap', 'node', (event) => {
      const nodeId = event.target.id();
      updateDetails(nodeId);
      vscode.postMessage({ type: 'nodeSelected', nodeId });
    });
    requestAnimationFrame(() => fitVisible());
    function runLayout(fitAfter) {
      cy.layout({ name: 'breadthfirst', directed: true, spacingFactor: 1.2, padding: 30 }).run();
      if (fitAfter) window.setTimeout(() => fitVisible(), 80);
    }
    function fitVisible() {
      const visible = cy.elements().filter((element) => element.visible());
      if (visible.length) cy.fit(visible, 32);
    }
    function centerContext() {
      const contextNodeId = selectedContextId || graph.nodes.find((node) => node.kind === 'context' || node.kind === 'child-context')?.id;
      if (!contextNodeId) return;
      const node = cy.getElementById(contextNodeId);
      if (node.length) {
        cy.center(node);
        node.select();
        updateDetails(contextNodeId);
      }
    }
    function updateDetails(nodeId) {
      const node = nodeById.get(nodeId);
      if (!node) return;
      document.getElementById('details-empty').classList.add('hidden');
      document.getElementById('details-content').classList.remove('hidden');
      document.getElementById('detail-label').textContent = node.label;
      document.getElementById('detail-kind').textContent = node.kind;
      document.getElementById('detail-parent').textContent = parentByNode.get(nodeId) || 'None';
      document.getElementById('detail-children').textContent = String(childCountByNode.get(nodeId) || 0);
      document.getElementById('detail-dependencies').textContent = String(dependencyCountByNode.get(nodeId) || 0);
      document.getElementById('detail-dependents').textContent = String(dependentCountByNode.get(nodeId) || 0);
    }
    function labelFor(nodeId) {
      return nodeById.get(nodeId)?.label || nodeId;
    }
  </script>
</body>
</html>`;
}
function renderEmptyHtml(title, message) {
    const nonce = nonceValue();
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(title)}</title><style nonce="${nonce}">html, body { height: 100%; margin: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); }.empty-state { display: grid; place-items: center; height: 100%; padding: 24px; box-sizing: border-box; text-align: center; }h1 { margin: 0 0 8px; font-size: 18px; font-weight: 600; }p { max-width: 520px; margin: 0; color: var(--vscode-descriptionForeground); line-height: 1.5; }</style></head><body><main class="empty-state"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></main></body></html>`;
}
function isContextMapMessage(message) {
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
function nodeId(kind, label) {
    return `${kind}:${slug(label)}`;
}
function slug(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
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
//# sourceMappingURL=DclContextMapGraphPanel.js.map