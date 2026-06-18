import * as vscode from "vscode";
import { DclGraphModel } from "../graphs/DclGraphModel";
import { revealSourceLocation } from "../source/DclSourceLocation";

type GraphWebviewMessage = {
  type: "nodeSelected";
  nodeId: string;
};

type WebviewGraphModel = Omit<DclGraphModel, "nodes"> & {
  nodes: Array<Omit<DclGraphModel["nodes"][number], "source">>;
};

export class DclCapabilityGraphPanel {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static currentGraph: DclGraphModel | undefined;

  static show(extensionUri: vscode.Uri, graph: DclGraphModel): void {
    const title = graph.title || "DCL Capability Graph";

    if (DclCapabilityGraphPanel.currentPanel) {
      DclCapabilityGraphPanel.currentGraph = graph;
      DclCapabilityGraphPanel.currentPanel.title = title;
      DclCapabilityGraphPanel.currentPanel.webview.html = renderHtml(DclCapabilityGraphPanel.currentPanel.webview, extensionUri, graph);
      DclCapabilityGraphPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "dclCapabilityGraph",
      title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "media"),
        ],
      },
    );

    DclCapabilityGraphPanel.currentPanel = panel;
    DclCapabilityGraphPanel.currentGraph = graph;
    panel.webview.html = renderHtml(panel.webview, extensionUri, graph);
    panel.webview.onDidReceiveMessage((message: unknown) => {
      void DclCapabilityGraphPanel.handleMessage(message);
    });
    panel.onDidDispose(() => {
      DclCapabilityGraphPanel.currentPanel = undefined;
      DclCapabilityGraphPanel.currentGraph = undefined;
    });
  }

  private static async handleMessage(message: unknown): Promise<void> {
    if (!isGraphWebviewMessage(message)) return;

    const node = DclCapabilityGraphPanel.currentGraph?.nodes.find((item) => item.id === message.nodeId);
    if (!node) return;

    if (!node.source) {
      void vscode.window.showWarningMessage(`No source location is available for graph node '${node.label}'.`);
      return;
    }

    const result = await revealSourceLocation(node.source, "oneBased");
    if (!result.ok) {
      void vscode.window.showWarningMessage(result.reason);
    }
  }
}

function renderHtml(webview: vscode.Webview, extensionUri: vscode.Uri, graph: DclGraphModel): string {
  const nonce = nonceValue();
  const cytoscapeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "cytoscape.min.js"));
  const graphJson = escapeScriptJson(toWebviewGraph(graph));

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
    }

    .title {
      font-weight: 600;
    }

    .subtitle {
      color: var(--vscode-descriptionForeground);
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
  </header>
  <main class="content">
    <section id="graph" aria-label="DCL capability graph"></section>
    <aside class="details" aria-live="polite">
      <h2 class="details-title">Node Details</h2>
      <p id="details-empty" class="empty-detail">Select a node to inspect it.</p>
      <div id="details-content" class="hidden">
        <p class="detail-row">
          <span class="detail-label">Label</span>
          <span id="detail-label" class="detail-value"></span>
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
    </aside>
  </main>
  <script nonce="${nonce}" src="${cytoscapeUri}"></script>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const graph = ${graphJson};
    const editorBackground = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
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
      layout: {
        name: 'breadthfirst',
        directed: true,
        roots: graph.nodes.filter((node) => node.kind === 'capability').map((node) => node.id),
        spacingFactor: 1.15,
        padding: 28
      },
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-wrap': 'wrap',
            'text-max-width': 140,
            'font-size': 11,
            'color': '#d4d4d4',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#4f6bed',
            'border-width': 1,
            'border-color': '#9db0ff',
            'width': 88,
            'height': 44,
            'shape': 'round-rectangle'
          }
        },
        {
          selector: 'node.capability',
          style: {
            'background-color': '#2ea043',
            'border-color': '#7ee787',
            'width': 132,
            'height': 58,
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
      userZoomingEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: false
    });

    cy.on('tap', 'node', (event) => {
      const node = event.target;
      const nodeId = node.id();
      updateDetails(nodeId);
      vscode.postMessage({ type: 'nodeSelected', nodeId });
    });

    function updateDetails(nodeId) {
      const node = nodeById.get(nodeId);
      if (!node) return;

      document.getElementById('details-empty').classList.add('hidden');
      document.getElementById('details-content').classList.remove('hidden');
      document.getElementById('detail-label').textContent = node.label;
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

function isGraphWebviewMessage(message: unknown): message is GraphWebviewMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Partial<GraphWebviewMessage>;
  return candidate.type === "nodeSelected" && typeof candidate.nodeId === "string" && candidate.nodeId.trim() !== "";
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
