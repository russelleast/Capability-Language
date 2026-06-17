import * as vscode from "vscode";
import { DclGraphModel } from "../graphs/DclGraphModel";

export class DclCapabilityGraphPanel {
  private static currentPanel: vscode.WebviewPanel | undefined;

  static show(extensionUri: vscode.Uri, graph: DclGraphModel): void {
    const title = graph.title || "DCL Capability Graph";

    if (DclCapabilityGraphPanel.currentPanel) {
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
    panel.webview.html = renderHtml(panel.webview, extensionUri, graph);
    panel.onDidDispose(() => {
      DclCapabilityGraphPanel.currentPanel = undefined;
    });
  }
}

function renderHtml(webview: vscode.Webview, extensionUri: vscode.Uri, graph: DclGraphModel): string {
  const nonce = nonceValue();
  const cytoscapeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "cytoscape.min.js"));
  const graphJson = escapeScriptJson(graph);

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

    #graph {
      width: 100vw;
      height: calc(100vh - 44px);
    }
  </style>
</head>
<body>
  <header class="toolbar">
    <span class="title">${escapeHtml(graph.title)}</span>
    <span class="subtitle">${graph.nodes.length} nodes, ${graph.edges.length} relationships</span>
  </header>
  <main id="graph" aria-label="DCL capability graph"></main>
  <script nonce="${nonce}" src="${cytoscapeUri}"></script>
  <script nonce="${nonce}">
    const graph = ${graphJson};
    const editorBackground = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';
    const elements = [
      ...graph.nodes.map((node) => ({
        data: { id: node.id, label: node.label, kind: node.kind },
        classes: node.kind
      })),
      ...graph.edges.map((edge) => ({
        data: { id: edge.id, source: edge.source, target: edge.target, label: edge.label, kind: edge.kind }
      }))
    ];

    cytoscape({
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
  </script>
</body>
</html>`;
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
