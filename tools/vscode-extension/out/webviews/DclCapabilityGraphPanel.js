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
exports.DclCapabilityGraphPanel = void 0;
const vscode = __importStar(require("vscode"));
const DclSourceLocation_1 = require("../source/DclSourceLocation");
class DclCapabilityGraphPanel {
    static show(extensionUri, graph, capabilities = [], onSwitchCapability) {
        const title = graph.title || "DCL Capability Graph";
        DclCapabilityGraphPanel.switchCapability = onSwitchCapability;
        if (DclCapabilityGraphPanel.currentPanel) {
            DclCapabilityGraphPanel.currentGraph = graph;
            DclCapabilityGraphPanel.currentPanel.title = title;
            DclCapabilityGraphPanel.currentPanel.webview.html = renderHtml(DclCapabilityGraphPanel.currentPanel.webview, extensionUri, graph, capabilities);
            DclCapabilityGraphPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
            return;
        }
        const panel = vscode.window.createWebviewPanel("dclCapabilityGraph", title, vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, "media"),
            ],
        });
        DclCapabilityGraphPanel.currentPanel = panel;
        DclCapabilityGraphPanel.currentGraph = graph;
        panel.webview.html = renderHtml(panel.webview, extensionUri, graph, capabilities);
        panel.webview.onDidReceiveMessage((message) => {
            void DclCapabilityGraphPanel.handleMessage(message);
        });
        panel.onDidDispose(() => {
            DclCapabilityGraphPanel.currentPanel = undefined;
            DclCapabilityGraphPanel.currentGraph = undefined;
            DclCapabilityGraphPanel.switchCapability = undefined;
        });
    }
    static showEmpty(extensionUri, title, message, capabilities = [], onSwitchCapability) {
        DclCapabilityGraphPanel.switchCapability = onSwitchCapability;
        if (DclCapabilityGraphPanel.currentPanel) {
            DclCapabilityGraphPanel.currentGraph = undefined;
            DclCapabilityGraphPanel.currentPanel.title = title;
            DclCapabilityGraphPanel.currentPanel.webview.html = renderEmptyHtml(DclCapabilityGraphPanel.currentPanel.webview, title, message, capabilities);
            DclCapabilityGraphPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
            return;
        }
        const panel = vscode.window.createWebviewPanel("dclCapabilityGraph", title, vscode.ViewColumn.Beside, {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, "media"),
            ],
        });
        DclCapabilityGraphPanel.currentPanel = panel;
        DclCapabilityGraphPanel.currentGraph = undefined;
        panel.webview.html = renderEmptyHtml(panel.webview, title, message, capabilities);
        panel.webview.onDidReceiveMessage((message) => {
            void DclCapabilityGraphPanel.handleMessage(message);
        });
        panel.onDidDispose(() => {
            DclCapabilityGraphPanel.currentPanel = undefined;
            DclCapabilityGraphPanel.currentGraph = undefined;
            DclCapabilityGraphPanel.switchCapability = undefined;
        });
    }
    static async handleMessage(message) {
        if (!isGraphWebviewMessage(message))
            return;
        if (message.type === "switchCapability") {
            await DclCapabilityGraphPanel.switchCapability?.();
            return;
        }
        const node = DclCapabilityGraphPanel.currentGraph?.nodes.find((item) => item.id === message.nodeId);
        if (!node)
            return;
        if (!node.source) {
            void vscode.window.showWarningMessage(`No source location is available for graph node '${node.label}'.`);
            return;
        }
        const result = await (0, DclSourceLocation_1.revealSourceLocation)(node.source, "oneBased");
        if (!result.ok) {
            void vscode.window.showWarningMessage(result.reason);
        }
    }
}
exports.DclCapabilityGraphPanel = DclCapabilityGraphPanel;
function renderHtml(webview, extensionUri, graph, capabilities) {
    const nonce = nonceValue();
    const cytoscapeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "cytoscape.min.js"));
    const graphJson = escapeScriptJson(toWebviewGraph(graph));
    const showCapabilitySwitch = capabilities.length > 1;
    const hasChildSemanticItems = graph.nodes.some((node) => node.kind !== "capability");
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

    .toolbar button,
    .toolbar select {
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 3px;
      padding: 4px 8px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      font: inherit;
      cursor: pointer;
      white-space: nowrap;
    }

    .toolbar select {
      max-width: 128px;
      background: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border-color: var(--vscode-dropdown-border);
    }

    .toolbar label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      color: var(--vscode-descriptionForeground);
    }

    .toolbar button:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .toolbar button.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .toolbar button.primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .toolbar button:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .content {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 260px;
      width: 100vw;
      height: calc(100vh - 44px);
      min-height: 0;
    }

    #graph {
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      position: relative;
    }

    .graph-empty {
      position: absolute;
      left: 16px;
      bottom: 16px;
      z-index: 2;
      max-width: min(420px, calc(100% - 32px));
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

    .filters,
    .legend {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .filter {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 8px 0;
      color: var(--vscode-sideBar-foreground);
    }

    .legend-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 10px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
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

    .swatch.capability { background: #2ea043; border-color: #7ee787; }
    .swatch.intent { background: #4f6bed; border-color: #9db0ff; }
    .swatch.outcome { background: #3b82f6; border-color: #93c5fd; }
    .swatch.rule { background: #d29922; border-color: #f2cc60; }
    .swatch.effect { background: #db6d28; border-color: #ffa657; }
    .swatch.event { background: #1f9d8a; border-color: #64d8cb; }
    .swatch.policy { background: #bf4b8a; border-color: #ff9ece; }
    .swatch.lifecycle { background: #8957e5; border-color: #d2a8ff; }

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

    .hidden {
      display: none;
    }

  </style>
</head>
<body>
  <header class="toolbar">
    <span class="title">${escapeHtml(graph.title)}</span>
    <span class="subtitle">${graph.nodes.length} nodes, ${graph.edges.length} relationships</span>
    <span class="toolbar-spacer"></span>
    <label for="layout-mode">Layout
      <select id="layout-mode">
        <option value="default">Default</option>
        <option value="layered">Layered</option>
        <option value="radial">Radial</option>
      </select>
    </label>
    <button id="fit-graph" type="button">Fit</button>
    <button id="reset-layout" type="button">Reset Layout</button>
    <button id="center-capability" type="button">Center Capability</button>
    <button id="switch-capability" class="primary" type="button"${showCapabilitySwitch ? "" : " disabled"}>Switch Capability</button>
  </header>
  <main class="content">
    <section id="graph" aria-label="DCL capability graph">
      <div id="graph-empty" class="graph-empty${hasChildSemanticItems ? " hidden" : ""}">This capability has no child semantic items in the compiled summary yet.</div>
    </section>
    <aside class="details" aria-live="polite">
      <h2 class="details-title">Node Details</h2>
      <p id="details-empty" class="empty-detail">Select a node to inspect it.</p>
      <div id="details-content" class="hidden">
        <p class="detail-row">
          <span class="detail-label">Display Label</span>
          <span id="detail-label" class="detail-value"></span>
        </p>
        <p class="detail-row">
          <span class="detail-label">Source Name</span>
          <span id="detail-source-name" class="detail-value"></span>
        </p>
        <p class="detail-row">
          <span class="detail-label">Kind</span>
          <span id="detail-kind" class="detail-value"></span>
        </p>
        <p class="detail-row">
          <span class="detail-label">Relationships</span>
          <span id="detail-relationships" class="detail-value"></span>
        </p>
      </div>
      <section class="filters">
        <h2 class="details-title">Filters</h2>
        <label class="filter"><input data-filter-kind="policy" type="checkbox" checked> Policies</label>
        <label class="filter"><input data-filter-kind="lifecycle" type="checkbox" checked> Lifecycle</label>
        <label class="filter"><input data-filter-kind="rule" type="checkbox" checked> Rules</label>
      </section>
      <section class="legend">
        <h2 class="details-title">Legend</h2>
        <div class="legend-grid">
          ${legendItemsHtml()}
        </div>
      </section>
    </aside>
  </main>
  <script nonce="${nonce}" src="${cytoscapeUri}"></script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const graph = ${graphJson};
    const editorBackground = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const capabilityNodeId = graph.nodes.find((node) => node.kind === 'capability')?.id;
    const hiddenKinds = new Set();
    let layoutMode = 'default';
    const incomingByNode = new Map();
    const outgoingByNode = new Map();
    for (const edge of graph.edges) {
      if (!outgoingByNode.has(edge.source)) outgoingByNode.set(edge.source, []);
      if (!incomingByNode.has(edge.target)) incomingByNode.set(edge.target, []);
      outgoingByNode.get(edge.source).push(edge);
      incomingByNode.get(edge.target).push(edge);
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
      layout: layoutOptions(layoutMode),
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-wrap': 'wrap',
            'text-max-width': 104,
            'text-overflow-wrap': 'anywhere',
            'font-size': 11,
            'color': '#d4d4d4',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#4f6bed',
            'border-width': 1,
            'border-color': '#9db0ff',
            'width': 88,
            'height': 62,
            'shape': 'round-rectangle'
          }
        },
        {
          selector: 'node.capability',
          style: {
            'background-color': '#2ea043',
            'border-color': '#7ee787',
            'width': 132,
            'height': 72,
            'font-size': 13,
            'font-weight': 700
          }
        },
        {
          selector: 'node.lifecycle',
          style: {
            'background-color': '#8957e5',
            'border-color': '#d2a8ff'
          }
        },
        {
          selector: 'node.rule',
          style: {
            'background-color': '#d29922',
            'border-color': '#f2cc60'
          }
        },
        {
          selector: 'node.outcome',
          style: {
            'background-color': '#3b82f6',
            'border-color': '#93c5fd'
          }
        },
        {
          selector: 'node.effect',
          style: {
            'background-color': '#db6d28',
            'border-color': '#ffa657'
          }
        },
        {
          selector: 'node.event',
          style: {
            'background-color': '#1f9d8a',
            'border-color': '#64d8cb'
          }
        },
        {
          selector: 'node.policy',
          style: {
            'background-color': '#bf4b8a',
            'border-color': '#ff9ece'
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
        }
      ],
      minZoom: 0.25,
      maxZoom: 2.5,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false
    });

    document.getElementById('fit-graph').addEventListener('click', () => fitVisible());
    document.getElementById('reset-layout').addEventListener('click', () => runLayout(true));
    document.getElementById('center-capability').addEventListener('click', () => centerCapability());
    document.getElementById('layout-mode').addEventListener('change', (event) => {
      layoutMode = event.target.value;
      runLayout(true);
    });
    document.getElementById('switch-capability').addEventListener('click', () => {
      vscode.postMessage({ type: 'switchCapability' });
    });

    document.querySelectorAll('[data-filter-kind]').forEach((input) => {
      input.addEventListener('change', () => {
        const kind = input.getAttribute('data-filter-kind');
        if (!kind) return;
        if (input.checked) hiddenKinds.delete(kind);
        else hiddenKinds.add(kind);
        updateFilters();
      });
    });

    cy.on('tap', 'node', (event) => {
      const node = event.target;
      const nodeId = node.id();
      updateDetails(nodeId);
      vscode.postMessage({ type: 'nodeSelected', nodeId });
    });

    requestAnimationFrame(() => fitVisible());

    function runLayout(fitAfter) {
      if (layoutMode === 'layered') {
        applyLayeredLayout();
        if (fitAfter) fitVisible();
        return;
      }

      cy.layout(layoutOptions(layoutMode)).run();
      if (fitAfter) window.setTimeout(() => fitVisible(), 100);
    }

    function layoutOptions(mode) {
      if (mode === 'radial') {
        return {
          name: 'concentric',
          concentric: (node) => node.id() === capabilityNodeId ? 3 : 1,
          levelWidth: () => 1,
          minNodeSpacing: 42,
          padding: 36,
          animate: false
        };
      }

      return {
        name: 'breadthfirst',
        directed: true,
        roots: capabilityNodeId ? [capabilityNodeId] : graph.nodes.filter((node) => node.kind === 'capability').map((node) => node.id),
        spacingFactor: 1.3,
        padding: 36,
        animate: false
      };
    }

    function applyLayeredLayout() {
      const visibleNodes = cy.nodes().filter((node) => node.visible());
      const capability = capabilityNodeId ? cy.getElementById(capabilityNodeId) : cy.collection();
      const kindOrder = ['intent', 'outcome', 'rule', 'effect', 'event', 'policy', 'lifecycle'];
      const rowHeight = 118;
      const columnWidth = 160;
      const blockGap = 34;
      const startY = -Math.floor(kindOrder.length / 2) * rowHeight;

      cy.batch(() => {
        if (capability.length && capability.visible()) {
          capability.position({ x: -240, y: 0 });
        }

        kindOrder.forEach((kind, kindIndex) => {
          const nodes = visibleNodes.filter((node) => node.data('kind') === kind).sort((a, b) => {
            return String(a.data('label')).localeCompare(String(b.data('label'))) || a.id().localeCompare(b.id());
          });
          if (!nodes.length) return;

          const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
          const rows = Math.ceil(nodes.length / columns);
          const baseY = startY + kindIndex * rowHeight + (rows > 1 ? blockGap : 0);
          nodes.forEach((node, index) => {
            const column = index % columns;
            const row = Math.floor(index / columns);
            node.position({
              x: 40 + column * columnWidth,
              y: baseY + row * 74
            });
          });
        });
      });
    }

    function fitVisible() {
      const visible = cy.elements().filter((element) => element.visible());
      if (visible.length) cy.fit(visible, 32);
    }

    function centerCapability() {
      if (!capabilityNodeId) return;
      const node = cy.getElementById(capabilityNodeId);
      if (node.length) {
        cy.center(node);
        node.select();
        updateDetails(capabilityNodeId);
      }
    }

    function updateFilters() {
      cy.nodes().forEach((node) => {
        const kind = node.data('kind');
        node.style('display', hiddenKinds.has(kind) ? 'none' : 'element');
      });
      cy.edges().forEach((edge) => {
        const sourceHidden = !edge.source().visible();
        const targetHidden = !edge.target().visible();
        edge.style('display', sourceHidden || targetHidden ? 'none' : 'element');
      });
      fitVisible();
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
  </script>
</body>
</html>`;
}
function renderEmptyHtml(_webview, title, message, capabilities) {
    const nonce = nonceValue();
    const canSwitch = capabilities.length > 0;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
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

    .toolbar {
      box-sizing: border-box;
      height: 44px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
      border-bottom: 1px solid var(--vscode-panel-border);
      font-size: 13px;
    }

    .title { font-weight: 600; }
    .toolbar-spacer { flex: 1 1 auto; }

    button {
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 3px;
      padding: 4px 8px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font: inherit;
      cursor: pointer;
    }

    button:hover { background: var(--vscode-button-hoverBackground); }
    button:disabled { opacity: 0.5; cursor: default; }

    .empty-state {
      display: grid;
      place-items: center;
      height: calc(100vh - 44px);
      padding: 24px;
      box-sizing: border-box;
      text-align: center;
    }

    .empty-state h1 {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 600;
    }

    .empty-state p {
      max-width: 520px;
      margin: 0;
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <header class="toolbar">
    <span class="title">${escapeHtml(title)}</span>
    <span class="toolbar-spacer"></span>
    <button id="switch-capability" type="button"${canSwitch ? "" : " disabled"}>Select Capability</button>
  </header>
  <main class="empty-state">
    <div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </div>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('switch-capability').addEventListener('click', () => {
      vscode.postMessage({ type: 'switchCapability' });
    });
  </script>
</body>
</html>`;
}
function isGraphWebviewMessage(message) {
    if (!message || typeof message !== "object")
        return false;
    const candidate = message;
    if (candidate.type === "switchCapability")
        return true;
    return candidate.type === "nodeSelected" && typeof candidate.nodeId === "string" && candidate.nodeId.trim() !== "";
}
function toWebviewGraph(graph) {
    return {
        ...graph,
        nodes: graph.nodes.map(({ source: _source, ...node }) => node),
    };
}
function legendItemsHtml() {
    return ["capability", "intent", "outcome", "rule", "effect", "event", "policy", "lifecycle"]
        .map((kind) => `<span class="legend-item"><span class="swatch ${kind}"></span>${kind}</span>`)
        .join("");
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
//# sourceMappingURL=DclCapabilityGraphPanel.js.map