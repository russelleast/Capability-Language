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
exports.DclEventFlowGraphPanel = void 0;
const vscode = __importStar(require("vscode"));
const DclSourceLocation_1 = require("../source/DclSourceLocation");
class DclEventFlowGraphPanel {
    static show(extensionUri, graph, selectedEvent) {
        const title = graph.title || "DCL Event Flow Graph";
        if (DclEventFlowGraphPanel.currentPanel) {
            DclEventFlowGraphPanel.currentGraph = graph;
            DclEventFlowGraphPanel.currentPanel.title = title;
            DclEventFlowGraphPanel.currentPanel.webview.html = renderHtml(DclEventFlowGraphPanel.currentPanel.webview, extensionUri, graph, selectedEvent);
            DclEventFlowGraphPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
            return;
        }
        const panel = vscode.window.createWebviewPanel("dclEventFlowGraph", title, vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, "media"),
            ],
        });
        DclEventFlowGraphPanel.currentPanel = panel;
        DclEventFlowGraphPanel.currentGraph = graph;
        panel.webview.html = renderHtml(panel.webview, extensionUri, graph, selectedEvent);
        panel.webview.onDidReceiveMessage((message) => {
            void DclEventFlowGraphPanel.handleMessage(message);
        });
        panel.onDidDispose(() => {
            DclEventFlowGraphPanel.currentPanel = undefined;
            DclEventFlowGraphPanel.currentGraph = undefined;
        });
    }
    static showEmpty(extensionUri, title, message) {
        if (DclEventFlowGraphPanel.currentPanel) {
            DclEventFlowGraphPanel.currentGraph = undefined;
            DclEventFlowGraphPanel.currentPanel.title = title;
            DclEventFlowGraphPanel.currentPanel.webview.html = renderEmptyHtml(title, message);
            DclEventFlowGraphPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
            return;
        }
        const panel = vscode.window.createWebviewPanel("dclEventFlowGraph", title, vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, "media"),
            ],
        });
        DclEventFlowGraphPanel.currentPanel = panel;
        DclEventFlowGraphPanel.currentGraph = undefined;
        panel.webview.html = renderEmptyHtml(title, message);
        panel.webview.onDidReceiveMessage((message) => {
            void DclEventFlowGraphPanel.handleMessage(message);
        });
        panel.onDidDispose(() => {
            DclEventFlowGraphPanel.currentPanel = undefined;
            DclEventFlowGraphPanel.currentGraph = undefined;
        });
    }
    static async handleMessage(message) {
        if (!isEventFlowGraphMessage(message))
            return;
        const node = DclEventFlowGraphPanel.currentGraph?.nodes.find((item) => item.id === message.nodeId);
        if (!node)
            return;
        if (!node.source) {
            void vscode.window.showWarningMessage(`No source location is available for event flow node '${node.label}'.`);
            return;
        }
        const result = await (0, DclSourceLocation_1.revealSourceLocation)(node.source, "oneBased");
        if (!result.ok) {
            void vscode.window.showWarningMessage(result.reason);
        }
    }
}
exports.DclEventFlowGraphPanel = DclEventFlowGraphPanel;
function renderHtml(webview, extensionUri, graph, selectedEvent) {
    const nonce = nonceValue();
    const cytoscapeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "cytoscape.min.js"));
    const graphJson = escapeScriptJson(toWebviewGraph(graph));
    const selectedEventId = selectedEvent ? nodeId("event", selectedEvent) : undefined;
    const hasEmitters = graph.edges.some((edge) => edge.kind === "emits");
    const hasReferences = graph.edges.some((edge) => edge.kind === "references" || edge.kind === "triggers-transition");
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
    .swatch.capability { background: #2ea043; border-color: #7ee787; }
    .swatch.event { background: #1f9d8a; border-color: #64d8cb; }
    .swatch.lifecycle { background: #8957e5; border-color: #d2a8ff; }
    .swatch.lifecycle-transition { background: #bf4b8a; border-color: #ff9ece; }
    .swatch.external-reference { background: #6e7681; border-color: #9da7b3; }
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
    <button id="center-event" type="button">Center Selected Event</button>
  </header>
  <main class="content">
    <section id="graph" aria-label="DCL event flow graph">
      <div class="graph-empty${hasEmitters ? " hidden" : ""}">Selected event has no known emitters in the compiled summary.</div>
      <div class="graph-empty${hasReferences ? " hidden" : ""}" style="bottom: ${hasEmitters ? "16" : "72"}px;">Selected event has no known references or consumers in the compiled summary.</div>
    </section>
    <aside class="details" aria-live="polite">
      <h2 class="details-title">Node Details</h2>
      <p id="details-empty" class="empty-detail">Select an event-flow node to inspect it.</p>
      <div id="details-content" class="hidden">
        <p class="detail-row"><span class="detail-label">Label</span><span id="detail-label" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Kind</span><span id="detail-kind" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Emitted By</span><span id="detail-emitted" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Referenced By / Triggered Transitions</span><span id="detail-referenced" class="detail-value"></span></p>
      </div>
      <section class="legend">
        <h2 class="details-title">Legend</h2>
        <span class="legend-item"><span class="swatch capability"></span>capability</span>
        <span class="legend-item"><span class="swatch event"></span>event</span>
        <span class="legend-item"><span class="swatch lifecycle"></span>lifecycle</span>
        <span class="legend-item"><span class="swatch lifecycle-transition"></span>lifecycle transition</span>
        <span class="legend-item"><span class="swatch external-reference"></span>external/unknown reference</span>
      </section>
    </aside>
  </main>
  <script nonce="${nonce}" src="${cytoscapeUri}"></script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const graph = ${graphJson};
    const selectedEventId = ${escapeScriptJson(selectedEventId)};
    const editorBackground = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const emittedBy = new Map();
    const referencedBy = new Map();
    for (const edge of graph.edges) {
      if (edge.kind === 'emits') add(emittedBy, edge.target, labelFor(edge.source));
      if (edge.kind === 'references') add(referencedBy, edge.source, labelFor(edge.target));
      if (edge.kind === 'triggers-transition') add(referencedBy, edge.source, 'transition ' + labelFor(edge.target));
    }
    const elements = [
      ...graph.nodes.map((node) => ({ data: { id: node.id, label: node.label, kind: node.kind }, classes: node.kind })),
      ...graph.edges.map((edge) => ({ data: { id: edge.id, source: edge.source, target: edge.target, label: edge.label, kind: edge.kind } }))
    ];
    const cy = cytoscape({
      container: document.getElementById('graph'),
      elements,
      layout: { name: 'breadthfirst', directed: true, roots: graph.nodes.filter((node) => node.kind === 'capability').map((node) => node.id), spacingFactor: 1.2, padding: 30 },
      style: [
        { selector: 'node', style: { 'label': 'data(label)', 'text-wrap': 'wrap', 'text-max-width': 150, 'font-size': 11, 'color': '#d4d4d4', 'text-valign': 'center', 'text-halign': 'center', 'background-color': '#4f6bed', 'border-width': 1, 'border-color': '#9db0ff', 'width': 96, 'height': 44, 'shape': 'round-rectangle' } },
        { selector: 'node.capability', style: { 'background-color': '#2ea043', 'border-color': '#7ee787', 'width': 132, 'height': 56, 'font-weight': 700 } },
        { selector: 'node.event', style: { 'background-color': '#1f9d8a', 'border-color': '#64d8cb', 'shape': 'ellipse', 'width': 106, 'height': 52 } },
        { selector: 'node.lifecycle', style: { 'background-color': '#8957e5', 'border-color': '#d2a8ff' } },
        { selector: 'node.lifecycle-transition', style: { 'background-color': '#bf4b8a', 'border-color': '#ff9ece' } },
        { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#f2cc60', 'overlay-color': '#f2cc60', 'overlay-opacity': 0.16 } },
        { selector: 'edge', style: { 'label': 'data(label)', 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'line-color': '#6e7681', 'target-arrow-color': '#6e7681', 'font-size': 9, 'color': '#9da7b3', 'text-background-color': editorBackground, 'text-background-opacity': 1, 'text-background-padding': 2, 'width': 1.4 } }
      ],
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false
    });
    document.getElementById('fit-graph').addEventListener('click', () => fitVisible());
    document.getElementById('reset-layout').addEventListener('click', () => runLayout(true));
    document.getElementById('center-event').addEventListener('click', () => centerEvent());
    cy.on('tap', 'node', (event) => {
      const nodeId = event.target.id();
      updateDetails(nodeId);
      vscode.postMessage({ type: 'nodeSelected', nodeId });
    });
    requestAnimationFrame(() => fitVisible());
    function runLayout(fitAfter) {
      cy.layout({ name: 'breadthfirst', directed: true, roots: graph.nodes.filter((node) => node.kind === 'capability').map((node) => node.id), spacingFactor: 1.2, padding: 30 }).run();
      if (fitAfter) window.setTimeout(() => fitVisible(), 80);
    }
    function fitVisible() {
      const visible = cy.elements().filter((element) => element.visible());
      if (visible.length) cy.fit(visible, 32);
    }
    function centerEvent() {
      const eventNodeId = selectedEventId || graph.nodes.find((node) => node.kind === 'event')?.id;
      if (!eventNodeId) return;
      const node = cy.getElementById(eventNodeId);
      if (node.length) {
        cy.center(node);
        node.select();
        updateDetails(eventNodeId);
      }
    }
    function updateDetails(nodeId) {
      const node = nodeById.get(nodeId);
      if (!node) return;
      document.getElementById('details-empty').classList.add('hidden');
      document.getElementById('details-content').classList.remove('hidden');
      document.getElementById('detail-label').textContent = node.label;
      document.getElementById('detail-kind').textContent = node.kind;
      document.getElementById('detail-emitted').textContent = listText(emittedBy.get(nodeId));
      document.getElementById('detail-referenced').textContent = listText(referencedBy.get(nodeId));
    }
    function add(map, key, value) {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(value);
    }
    function listText(items) {
      return items?.length ? Array.from(new Set(items)).join('; ') : 'None known';
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
function isEventFlowGraphMessage(message) {
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
//# sourceMappingURL=DclEventFlowGraphPanel.js.map