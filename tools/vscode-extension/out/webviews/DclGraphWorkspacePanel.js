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
exports.DclGraphWorkspacePanel = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const DclCapabilityMapBuilder_1 = require("../graphs/DclCapabilityMapBuilder");
const DclCauseEffectLayout_1 = require("../graphs/DclCauseEffectLayout");
const DclGraphLabels_1 = require("../graphs/DclGraphLabels");
const DclSemanticIdentity_1 = require("../graphs/DclSemanticIdentity");
class DclGraphWorkspacePanel {
    static show(extensionUri, state, callbacks) {
        DclGraphWorkspacePanel.callbacks = callbacks;
        DclGraphWorkspacePanel.currentGraph = state.graph;
        DclGraphWorkspacePanel.currentCapabilityMap = state.capabilityMap;
        if (DclGraphWorkspacePanel.currentPanel) {
            DclGraphWorkspacePanel.currentPanel.title = "DCL Graph Workspace";
            DclGraphWorkspacePanel.currentPanel.webview.html = renderHtml(DclGraphWorkspacePanel.currentPanel.webview, extensionUri, state);
            DclGraphWorkspacePanel.currentPanel.reveal(vscode.ViewColumn.Active);
            return;
        }
        const panel = vscode.window.createWebviewPanel("dclGraphWorkspace", "DCL Graph Workspace", vscode.ViewColumn.Active, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
        });
        DclGraphWorkspacePanel.currentPanel = panel;
        panel.webview.html = renderHtml(panel.webview, extensionUri, state);
        panel.webview.onDidReceiveMessage((message) => {
            void DclGraphWorkspacePanel.handleMessage(message);
        });
        panel.onDidDispose(() => {
            DclGraphWorkspacePanel.currentPanel = undefined;
            DclGraphWorkspacePanel.currentGraph = undefined;
            DclGraphWorkspacePanel.currentCapabilityMap = undefined;
            DclGraphWorkspacePanel.callbacks = undefined;
        });
    }
    static showNoSummary(extensionUri, callbacks) {
        DclGraphWorkspacePanel.showEmpty(extensionUri, "No Compiled Semantic Summary", "Compile your DCL workspace before opening graph views.", callbacks);
    }
    static showCompileFailed(message = "Compile failed. Fix compiler diagnostics and refresh the graph workspace.") {
        if (!DclGraphWorkspacePanel.currentPanel)
            return;
        DclGraphWorkspacePanel.currentGraph = undefined;
        DclGraphWorkspacePanel.currentCapabilityMap = undefined;
        DclGraphWorkspacePanel.currentPanel.webview.html = renderEmptyHtml("Compile Failed", message, true);
    }
    static refreshCurrent() {
        if (!DclGraphWorkspacePanel.currentPanel)
            return;
        DclGraphWorkspacePanel.callbacks?.onRefresh();
    }
    static isVisible() {
        return DclGraphWorkspacePanel.currentPanel?.visible === true;
    }
    static focusSemanticIdentity(identity, options = {}) {
        const node = (0, DclSemanticIdentity_1.findGraphNodeBySemanticIdentity)(DclGraphWorkspacePanel.currentGraph, identity);
        const mapItem = (0, DclCapabilityMapBuilder_1.capabilityMapItems)(DclGraphWorkspacePanel.currentCapabilityMap).find((item) => (identity && item.semanticIdentity.kind === identity.kind && item.semanticIdentity.name === identity.name));
        const itemId = node?.id ?? mapItem?.id;
        if (!itemId || !DclGraphWorkspacePanel.currentPanel)
            return false;
        if (options.reveal !== false) {
            DclGraphWorkspacePanel.currentPanel.reveal(vscode.ViewColumn.Active);
        }
        else if (!DclGraphWorkspacePanel.currentPanel.visible) {
            return false;
        }
        void DclGraphWorkspacePanel.currentPanel.webview.postMessage({ type: "focusNode", nodeId: itemId });
        return true;
    }
    static async exportCurrentGraph(format) {
        if (!DclGraphWorkspacePanel.currentPanel || (!DclGraphWorkspacePanel.currentGraph && !DclGraphWorkspacePanel.currentCapabilityMap)) {
            void vscode.window.showWarningMessage("Open a DCL visual before exporting.");
            return;
        }
        const selected = format ?? await vscode.window.showQuickPick([
            { label: "SVG", description: "Best for documentation", format: "svg" },
            { label: "PNG", description: "Best for quick sharing", format: "png" },
        ], { title: "Export DCL Graph" }).then((item) => item?.format);
        if (!selected)
            return;
        await DclGraphWorkspacePanel.currentPanel.webview.postMessage({ type: "requestExport", format: selected });
    }
    static showEmpty(extensionUri, title, message, callbacks) {
        DclGraphWorkspacePanel.callbacks = callbacks;
        DclGraphWorkspacePanel.currentGraph = undefined;
        DclGraphWorkspacePanel.currentCapabilityMap = undefined;
        if (DclGraphWorkspacePanel.currentPanel) {
            DclGraphWorkspacePanel.currentPanel.webview.html = renderEmptyHtml(title, message, true);
            DclGraphWorkspacePanel.currentPanel.reveal(vscode.ViewColumn.Active);
            return;
        }
        const panel = vscode.window.createWebviewPanel("dclGraphWorkspace", "DCL Graph Workspace", vscode.ViewColumn.Active, { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")] });
        DclGraphWorkspacePanel.currentPanel = panel;
        panel.webview.html = renderEmptyHtml(title, message, true);
        panel.webview.onDidReceiveMessage((message) => {
            void DclGraphWorkspacePanel.handleMessage(message);
        });
        panel.onDidDispose(() => {
            DclGraphWorkspacePanel.currentPanel = undefined;
            DclGraphWorkspacePanel.currentGraph = undefined;
            DclGraphWorkspacePanel.currentCapabilityMap = undefined;
            DclGraphWorkspacePanel.callbacks = undefined;
        });
    }
    static async handleMessage(message) {
        if (!isGraphWorkspaceMessage(message))
            return;
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
        if (message.type === "nodeSelected")
            return;
        const node = DclGraphWorkspacePanel.currentGraph?.nodes.find((item) => item.id === message.nodeId);
        const mapItem = (0, DclCapabilityMapBuilder_1.capabilityMapItems)(DclGraphWorkspacePanel.currentCapabilityMap).find((item) => item.id === message.nodeId);
        const item = node ?? mapItem;
        if (!item)
            return;
        if (!item.source) {
            void vscode.window.showWarningMessage(`No source location is available for '${itemName(item)}'.`);
            return;
        }
        DclGraphWorkspacePanel.callbacks?.onRevealSource(item.source);
    }
}
exports.DclGraphWorkspacePanel = DclGraphWorkspacePanel;
function itemName(item) {
    return "label" in item ? item.sourceName ?? item.label : item.name;
}
async function saveGraphExport(message) {
    try {
        const filename = safeExportFilename(message.filename, message.format);
        const target = await vscode.window.showSaveDialog({
            defaultUri: defaultExportUri(filename),
            filters: message.format === "svg" ? { SVG: ["svg"] } : { PNG: ["png"] },
            saveLabel: `Export ${message.format.toUpperCase()}`,
        });
        if (!target)
            return;
        const bytes = message.format === "svg"
            ? Buffer.from(message.text ?? "", "utf8")
            : pngBytes(message.dataUri ?? "");
        if (!bytes.length) {
            throw new Error("Export payload was empty.");
        }
        await vscode.workspace.fs.writeFile(target, bytes);
        void vscode.window.showInformationMessage(`DCL graph exported to ${target.fsPath}`);
    }
    catch (error) {
        void vscode.window.showErrorMessage(`DCL graph export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function safeExportFilename(filename, format) {
    const basename = path.basename(filename).replace(/[^a-z0-9_.-]+/gi, "-");
    return basename.toLowerCase().endsWith(`.${format}`) ? basename : `${basename}.${format}`;
}
function defaultExportUri(filename) {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    return root ? vscode.Uri.file(path.join(root, filename)) : undefined;
}
function pngBytes(dataUri) {
    const match = /^data:image\/png;base64,(.+)$/i.exec(dataUri);
    if (!match)
        throw new Error("PNG export payload was not a valid data URI.");
    return Buffer.from(match[1], "base64");
}
function renderHtml(webview, extensionUri, state) {
    const nonce = nonceValue();
    const cytoscapeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "cytoscape.min.js"));
    const graphJson = escapeScriptJson(state.graph ? toWebviewGraph(state.graph, state.graphType) : undefined);
    const mapJson = escapeScriptJson(state.capabilityMap ? toWebviewCapabilityMap(state.capabilityMap) : undefined);
    const stateJson = escapeScriptJson(toWebviewState(state));
    const graph = state.graph;
    const map = state.capabilityMap;
    const visualAvailable = Boolean(graph || map);
    const visualLabel = map ? "map" : "graph";
    const visualLabelTitle = map ? "visual" : "graph";
    const actionLabel = map ? "Map actions" : "Graph actions";
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src ${webview.cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DCL Graph Workspace</title>
  <style nonce="${nonce}">
    html, body { height: 100%; margin: 0; padding: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); overflow: hidden; }
    body { display: flex; flex-direction: column; }
    .toolbar { box-sizing: border-box; display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 12px; overflow: visible; }
    .control-group, .action-group { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; }
    .control-group { flex: 1 1 540px; }
    .action-group { flex: 0 1 auto; justify-content: flex-end; margin-left: auto; }
    .toolbar label { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; color: var(--vscode-descriptionForeground); min-width: 0; }
    .toolbar select, .toolbar button { border: 1px solid var(--vscode-button-border, transparent); border-radius: 3px; padding: 3px 7px; font: inherit; line-height: 18px; white-space: nowrap; }
    .toolbar select { max-width: 170px; min-width: 92px; background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border-color: var(--vscode-dropdown-border); }
    #subject { max-width: 220px; }
    .toolbar button { min-width: 32px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); cursor: pointer; text-align: center; }
    .toolbar button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .toolbar button.primary { min-width: 58px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .toolbar button.primary:hover { background: var(--vscode-button-hoverBackground); }
    .toolbar button:disabled { opacity: 0.55; cursor: default; }
    .graph-status { box-sizing: border-box; min-height: 22px; display: flex; align-items: center; gap: 12px; padding: 3px 10px; border-bottom: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .graph-note { box-sizing: border-box; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); font-size: 11px; line-height: 1.4; }
    .graph-warnings { box-sizing: border-box; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); color: var(--vscode-editorWarning-foreground, #cca700); font-size: 11px; line-height: 1.4; }
    .graph-warnings ul { margin: 4px 0 0 18px; padding: 0; }
    .content { flex: 1 1 auto; display: grid; grid-template-columns: minmax(0, 1fr) 290px; width: 100vw; min-height: 0; }
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
    .map-viewport { position: absolute; inset: 0; overflow: auto; background: var(--vscode-editor-background); cursor: grab; }
    .map-viewport.dragging { cursor: grabbing; }
    .capability-map-svg { display: block; transform-origin: 0 0; }
    .map-context-rect { fill: color-mix(in srgb, var(--vscode-sideBar-background) 68%, transparent); stroke: var(--vscode-panel-border); stroke-width: 1.2; }
    .map-context-header { fill: var(--vscode-sideBar-background); stroke: var(--vscode-panel-border); stroke-width: 1; }
    .map-context-label { fill: var(--vscode-editor-foreground); font-size: 13px; font-weight: 700; }
    .map-tile { fill: var(--vscode-editorWidget-background, #252526); stroke: var(--vscode-panel-border); stroke-width: 1.2; }
    .map-tile-title { fill: var(--vscode-editor-foreground); font-size: 12px; font-weight: 700; }
    .map-item { cursor: pointer; }
    .map-item.selected .map-context-rect, .map-item.selected .map-tile { stroke: var(--vscode-focusBorder, #007fd4); stroke-width: 2.5; }
    .map-help { margin: 0 0 14px; padding: 10px; border: 1px solid var(--vscode-panel-border); color: var(--vscode-descriptionForeground); background: var(--vscode-editor-background); line-height: 1.45; }
    .map-legend-context { background: transparent; border-color: var(--vscode-panel-border); }
    .map-legend-capability { background: var(--vscode-editorWidget-background, #252526); border-color: var(--vscode-panel-border); }
    .hidden { display: none; }
  </style>
</head>
<body>
  <header class="toolbar" aria-label="Graph workspace controls">
    <div class="control-group">
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
    </div>
    <div class="action-group" aria-label="${actionLabel}">
      <button id="refresh" type="button" title="Refresh graph data" aria-label="Refresh graph data">↻</button>
      <button id="compile-workspace" class="primary" type="button" title="Compile workspace" aria-label="Compile workspace">Compile</button>
      <button id="export-svg" type="button" title="Export ${visualLabelTitle} as SVG" aria-label="Export ${visualLabelTitle} as SVG"${visualAvailable ? "" : " disabled"}>SVG</button>
      <button id="export-png" type="button" title="Export ${visualLabelTitle} as PNG" aria-label="Export ${visualLabelTitle} as PNG"${visualAvailable ? "" : " disabled"}>PNG</button>
      <button id="fit-graph" type="button" title="Fit ${visualLabel} to view" aria-label="Fit ${visualLabel} to view"${visualAvailable ? "" : " disabled"}>Fit</button>
      <button id="reset-layout" type="button" title="Reset ${visualLabel} layout" aria-label="Reset ${visualLabel} layout"${visualAvailable ? "" : " disabled"}>Reset</button>
      <button id="center-selection" type="button" title="Center selected ${map ? "item" : "node"}" aria-label="Center selected ${map ? "item" : "node"}"${visualAvailable ? "" : " disabled"}>Center</button>
    </div>
  </header>
  <div class="graph-status" aria-live="polite">${statusText(graph, map)}</div>
  ${(graph?.description ?? map?.description) ? `<div class="graph-note">${escapeHtml(graph?.description ?? map?.description ?? "")}</div>` : ""}
  ${(graph?.warnings ?? map?.warnings)?.length ? `<div class="graph-warnings"><strong>Warnings</strong><ul>${(graph?.warnings ?? map?.warnings ?? []).map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></div>` : ""}
  <main class="content">
    <section id="graph" aria-label="DCL visual workspace">
      ${visualAvailable ? "" : `<div class="empty-state"><div><h1>${escapeHtml(state.emptyTitle ?? "No Visual Available")}</h1><p>${escapeHtml(state.emptyMessage ?? "Compile DCL or choose another visual subject.")}</p><button id="empty-compile" class="primary" type="button">Compile Workspace</button></div></div>`}
    </section>
    <aside class="details" aria-live="polite">
      <h2 class="details-title">${map ? "Map Details" : "Node Details"}</h2>
      ${map ? `<p class="map-help">${escapeHtml(map.description)}</p>` : ""}
      <p id="details-empty" class="empty-detail">Select a ${map ? "context or capability" : "node"} to inspect it.</p>
      <div id="details-content" class="hidden">
        <p class="detail-row"><span class="detail-label">${map ? "Map Size" : "Graph Size"}</span><span class="detail-value">${statusText(graph, map)}</span></p>
        <p class="detail-row"><span class="detail-label">Display Label</span><span id="detail-label" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Source Name</span><span id="detail-source-name" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">Kind</span><span id="detail-kind" class="detail-value"></span></p>
        <p class="detail-row"><span class="detail-label">${map ? "Contents" : "Relationships"}</span><span id="detail-relationships" class="detail-value"></span></p>
        <div id="source-section" class="detail-row hidden"><span class="detail-label">Source</span><div class="detail-actions"><button id="open-source" type="button">Open Source</button></div></div>
        <div id="show-in-section" class="detail-row hidden"><span class="detail-label">Show In</span><div id="show-in-actions" class="detail-actions"></div></div>
      </div>
      <section class="legend">
        <h2 class="details-title">Legend</h2>
        <div class="legend-grid">${map ? capabilityMapLegendHtml() : legendItemsHtml(graph)}</div>
      </section>
    </aside>
  </main>
  ${graph ? `<script nonce="${nonce}" src="${cytoscapeUri}"></script>` : ""}
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const workspaceState = ${stateJson};
    const graph = ${graphJson};
    const capabilityMap = ${mapJson};
    const editorBackground = getComputedStyle(document.body).getPropertyValue('--vscode-editor-background').trim() || '#1e1e1e';
    const graphTypeInput = document.getElementById('graph-type');
    const subjectInput = document.getElementById('subject');
    const detailInput = document.getElementById('architecture-detail');
    const layoutInput = document.getElementById('layout-mode');
    const nodeById = new Map((graph?.nodes || []).map((node) => [node.id, node]));
    const edgeById = new Map((graph?.edges || []).map((edge) => [edge.id, edge]));
    const mapItemById = new Map();
    const incomingByNode = new Map();
    const outgoingByNode = new Map();
    let cy;
    let mapSvg;
    let mapGroup;
    let mapLayout = new Map();
    let mapTransform = { x: 24, y: 24, scale: 1 };
    let lastSelectedNodeId;
    let layoutMode = 'default';

    for (const edge of graph?.edges || []) {
      if (!outgoingByNode.has(edge.source)) outgoingByNode.set(edge.source, []);
      if (!incomingByNode.has(edge.target)) incomingByNode.set(edge.target, []);
      outgoingByNode.get(edge.source).push(edge);
      incomingByNode.get(edge.target).push(edge);
    }
    if (capabilityMap) {
      for (const item of flattenMapItems(capabilityMap.root)) {
        mapItemById.set(item.id, item);
      }
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

    if (capabilityMap) {
      renderCapabilityMap();
      document.getElementById('fit-graph').addEventListener('click', () => fitMap());
      document.getElementById('reset-layout').addEventListener('click', () => {
        renderCapabilityMap();
        fitMap();
      });
      document.getElementById('center-selection').addEventListener('click', () => centerMapSelection());
      requestAnimationFrame(() => {
        fitMap();
        if (workspaceState.focusNodeId) {
          window.setTimeout(() => focusNode(workspaceState.focusNodeId), 80);
        }
      });
    } else if (graph) {
      const elements = [
        ...graph.nodes.map((node) => ({ data: { id: node.id, label: node.wrappedLabel, displayLabel: node.label, kind: node.kind }, classes: node.kind })),
        ...graph.edges.map((edge) => ({ data: { id: edge.id, source: edge.source, target: edge.target, label: edge.label, kind: edge.kind, score: edge.score, edgeWidth: edge.score ? edgeWidth(edge.score) : 1.4 } }))
      ];
      cy = cytoscape({
        container: document.getElementById('graph'),
        elements,
        layout: layoutOptions(),
        style: styleSheet(),
        minZoom: 0.25,
        maxZoom: 2.5,
        wheelSensitivity: 0.22,
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
      cy.on('tap', 'edge', (event) => {
        const edgeId = event.target.id();
        lastSelectedNodeId = undefined;
        updateEdgeDetails(edgeId);
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

    function renderCapabilityMap() {
      const container = document.getElementById('graph');
      container.replaceChildren();
      const viewport = document.createElement('div');
      viewport.className = 'map-viewport';
      container.appendChild(viewport);
      const layout = layoutMapRoot(capabilityMap.root);
      mapLayout = collectMapLayout(layout);
      mapSvg = svgElement('svg');
      mapSvg.classList.add('capability-map-svg');
      mapSvg.setAttribute('width', String(layout.width + 48));
      mapSvg.setAttribute('height', String(layout.height + 48));
      mapSvg.setAttribute('viewBox', '0 0 ' + (layout.width + 48) + ' ' + (layout.height + 48));
      mapGroup = svgElement('g');
      mapGroup.setAttribute('transform', transformValue());
      mapSvg.appendChild(mapGroup);
      drawMapLayout(mapGroup, layout, 0, 0);
      viewport.appendChild(mapSvg);
      wireMapPanZoom(viewport);
    }

    function layoutMapRoot(root) {
      if (!root.synthetic) return layoutMapContext(root, 0);
      const childLayouts = root.children.map((child) => layoutMapContext(child, 0));
      const padding = 18;
      const gap = 28;
      const containerWidth = Math.max(720, document.getElementById('graph').clientWidth - 96);
      const fallback = layoutMapTiles(root.capabilities || [], padding, 0, Math.max(1, Math.floor((containerWidth - padding * 2) / (174 + 14))));
      let cursorX = padding;
      let cursorY = fallback.height ? fallback.height + gap : padding;
      let rowHeight = 0;
      let width = Math.max(containerWidth, fallback.width);
      const children = [];
      for (const child of childLayouts) {
        if (cursorX > padding && cursorX + child.width > containerWidth) {
          cursorX = padding;
          cursorY += rowHeight + gap;
          rowHeight = 0;
        }
        children.push({ ...child, x: cursorX, y: cursorY });
        cursorX += child.width + gap;
        rowHeight = Math.max(rowHeight, child.height);
        width = Math.max(width, cursorX);
      }
      return {
        item: root,
        x: 0,
        y: 0,
        width,
        height: Math.max(cursorY + rowHeight + padding, fallback.height + padding),
        tiles: fallback.tiles,
        children,
        synthetic: true
      };
    }

    function layoutMapContext(context, depth) {
      const padding = 18;
      const headerHeight = 34;
      const gap = 14;
      const childLayouts = context.children.map((child) => layoutMapContext(child, depth + 1));
      const tiles = layoutMapTiles(context.capabilities || [], padding, headerHeight + padding);
      const tileAreaWidth = context.capabilities.length ? tiles.width : 280;
      const tileAreaHeight = context.capabilities.length ? headerHeight + padding + tiles.height : headerHeight + padding * 2 + 28;
      let cursorY = tileAreaHeight;
      let contentWidth = tileAreaWidth;
      const children = childLayouts.map((child) => {
        const placed = { ...child, x: padding, y: cursorY, width: child.width, height: child.height };
        cursorY += child.height + gap;
        contentWidth = Math.max(contentWidth, child.width + padding * 2);
        return placed;
      });
      return {
        item: context,
        x: 0,
        y: 0,
        width: Math.max(contentWidth, 300),
        height: Math.max(cursorY + padding, tileAreaHeight),
        tiles: tiles.tiles,
        children
      };
    }

    function layoutMapTiles(capabilities, padding, startY, requestedColumns) {
      const tileWidth = 174;
      const tileHeight = 72;
      const gap = 14;
      if (!capabilities.length) return { width: 0, height: 0, tiles: [] };
      const columns = requestedColumns || Math.max(1, Math.min(4, Math.ceil(Math.sqrt(Math.max(1, capabilities.length)))));
      const tiles = capabilities.map((capability, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        return { item: capability, x: padding + column * (tileWidth + gap), y: startY + row * (tileHeight + gap), width: tileWidth, height: tileHeight };
      });
      const rows = Math.ceil(capabilities.length / columns);
      return {
        width: padding * 2 + columns * tileWidth + (columns - 1) * gap,
        height: rows * tileHeight + (rows - 1) * gap,
        tiles
      };
    }

    function collectMapLayout(contextLayout) {
      const result = new Map();
      function visit(layout, offsetX, offsetY) {
        result.set(layout.item.id, { x: offsetX, y: offsetY, width: layout.width, height: layout.height, item: layout.item });
        for (const tile of layout.tiles) {
          result.set(tile.item.id, { x: offsetX + tile.x, y: offsetY + tile.y, width: tile.width, height: tile.height, item: tile.item });
        }
        for (const child of layout.children) visit(child, offsetX + child.x, offsetY + child.y);
      }
      visit(contextLayout, 0, 0);
      return result;
    }

    function drawMapLayout(parent, layout, offsetX, offsetY) {
      if (layout.synthetic) {
        for (const tile of layout.tiles) drawCapabilityTile(parent, tile, offsetX, offsetY);
        for (const child of layout.children) drawMapContext(parent, child, offsetX, offsetY);
        return;
      }
      drawMapContext(parent, layout, offsetX, offsetY);
    }

    function drawMapContext(parent, layout, offsetX, offsetY) {
      const x = offsetX + layout.x;
      const y = offsetY + layout.y;
      const group = mapItemGroup(layout.item);
      group.appendChild(svgRect(x, y, layout.width, layout.height, 8, 'map-context-rect'));
      group.appendChild(svgRect(x, y, layout.width, 34, 8, 'map-context-header'));
      group.appendChild(svgText(layout.item.label, x + 14, y + 22, 'map-context-label'));
      parent.appendChild(group);

      for (const tile of layout.tiles) drawCapabilityTile(parent, tile, x, y);
      for (const child of layout.children) drawMapContext(parent, child, x, y);
    }

    function drawCapabilityTile(parent, tile, offsetX, offsetY) {
      const x = offsetX + tile.x;
      const y = offsetY + tile.y;
      const group = mapItemGroup(tile.item);
      group.appendChild(svgRect(x, y, tile.width, tile.height, 6, 'map-tile'));
      for (const line of wrapWords(tile.item.label, 22).slice(0, 2)) {
        group.appendChild(svgText(line.text, x + 12, y + 20 + line.index * 15, 'map-tile-title'));
      }
      parent.appendChild(group);
    }

    function mapItemGroup(item) {
      const group = svgElement('g');
      group.classList.add('map-item');
      group.dataset.itemId = item.id;
      group.addEventListener('click', (event) => {
        event.stopPropagation();
        selectMapItem(item.id);
      });
      if (item.kind === 'capability') {
        group.addEventListener('dblclick', (event) => {
          event.stopPropagation();
          vscode.postMessage({ type: 'revealSource', nodeId: item.id });
        });
      }
      return group;
    }

    function selectMapItem(itemId) {
      lastSelectedNodeId = itemId;
      document.querySelectorAll('.map-item.selected').forEach((element) => element.classList.remove('selected'));
      document.querySelectorAll('.map-item').forEach((element) => {
        if (element.dataset.itemId === itemId) element.classList.add('selected');
      });
      updateMapDetails(itemId);
      vscode.postMessage({ type: 'nodeSelected', nodeId: itemId });
    }

    function updateMapDetails(itemId) {
      const item = mapItemById.get(itemId);
      if (!item) return;
      document.getElementById('details-empty').classList.add('hidden');
      document.getElementById('details-content').classList.remove('hidden');
      document.getElementById('detail-label').textContent = item.label;
      document.getElementById('detail-source-name').textContent = item.sourceName || item.name;
      document.getElementById('detail-kind').textContent = item.kind === 'capability' ? 'capability tile' : 'context container';
      document.getElementById('detail-relationships').textContent = item.kind === 'capability' ? capabilityDetail(item) : contextDetail(item);
      document.getElementById('source-section').classList.toggle('hidden', !item.hasSource);
      updateShowInActions(itemId);
    }

    function capabilityDetail(item) {
      return item.hasSource ? 'Source navigation available' : 'No source location available';
    }

    function contextDetail(item) {
      const capabilityCount = countCapabilities(item);
      const contextCount = item.children?.length || 0;
      return capabilityCount + ' capabilit' + (capabilityCount === 1 ? 'y' : 'ies') + ', ' + contextCount + ' child context' + (contextCount === 1 ? '' : 's');
    }

    function countCapabilities(item) {
      return (item.capabilities?.length || 0) + (item.children || []).reduce((sum, child) => sum + countCapabilities(child), 0);
    }

    function flattenMapItems(root) {
      const items = [];
      function visit(context) {
        items.push(context);
        for (const capability of context.capabilities || []) items.push(capability);
        for (const child of context.children || []) visit(child);
      }
      visit(root);
      return items;
    }

    function wireMapPanZoom(viewport) {
      let dragStart;
      viewport.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        dragStart = { x: event.clientX, y: event.clientY, tx: mapTransform.x, ty: mapTransform.y };
        viewport.setPointerCapture(event.pointerId);
        viewport.classList.add('dragging');
      });
      viewport.addEventListener('pointermove', (event) => {
        if (!dragStart) return;
        mapTransform.x = dragStart.tx + event.clientX - dragStart.x;
        mapTransform.y = dragStart.ty + event.clientY - dragStart.y;
        applyMapTransform();
      });
      viewport.addEventListener('pointerup', (event) => {
        dragStart = undefined;
        viewport.releasePointerCapture(event.pointerId);
        viewport.classList.remove('dragging');
      });
      viewport.addEventListener('wheel', (event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        const delta = Math.max(-80, Math.min(80, event.deltaY));
        const factor = Math.exp(-delta * 0.0018);
        mapTransform.scale = Math.max(0.35, Math.min(2.0, mapTransform.scale * factor));
        applyMapTransform();
      }, { passive: false });
    }

    function fitMap() {
      if (!mapSvg || !capabilityMap) return;
      const container = document.getElementById('graph');
      const width = Number(mapSvg.getAttribute('width')) || 800;
      const height = Number(mapSvg.getAttribute('height')) || 600;
      const scale = Math.max(0.25, Math.min(1.2, Math.min((container.clientWidth - 32) / width, (container.clientHeight - 32) / height)));
      mapTransform = { x: 16, y: 16, scale };
      applyMapTransform();
    }

    function centerMapSelection() {
      const itemId = lastSelectedNodeId || capabilityMap.root.id;
      focusNode(itemId);
    }

    function applyMapTransform() {
      mapGroup?.setAttribute('transform', transformValue());
    }

    function transformValue() {
      return 'translate(' + round(mapTransform.x) + ' ' + round(mapTransform.y) + ') scale(' + round(mapTransform.scale) + ')';
    }

    function layoutOptions() {
      if (workspaceState.graphType === 'cause-effect') {
        return { name: 'preset', positions: graph.layoutPositions || causeEffectPositions(), padding: 72, animate: false };
      }
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

    function causeEffectPositions() {
      const order = ['intent', 'capability', 'rule', 'policy', 'effect', 'outcome', 'event', 'lifecycle-transition', 'step', 'terminal-step'];
      const byKind = new Map();
      for (const node of graph.nodes) {
        const kind = node.kind;
        if (!byKind.has(kind)) byKind.set(kind, []);
        byKind.get(kind).push(node);
      }
      const positions = {};
      const columnWidth = 190;
      const rowHeight = 106;
      for (const [kind, nodes] of byKind.entries()) {
        const column = Math.max(0, order.indexOf(kind));
        const sorted = nodes.slice().sort((a, b) => String(a.label).localeCompare(String(b.label)) || String(a.id).localeCompare(String(b.id)));
        const startY = -((sorted.length - 1) * rowHeight) / 2;
        sorted.forEach((node, index) => {
          positions[node.id] = { x: column * columnWidth, y: startY + index * rowHeight };
        });
      }
      return positions;
    }

    function fitVisible() {
      const visible = cy?.elements().filter((element) => element.visible());
      if (!visible?.length) return;
      const fitPadding = workspaceState.graphType === 'architecture' ? 36 : 48;
      const minimumInitialZoom = workspaceState.graphType === 'architecture' ? 0.68 : 0.58;
      cy.fit(visible, fitPadding);
      if (visible.nodes().length <= 35 && cy.zoom() < minimumInitialZoom) {
        cy.zoom(minimumInitialZoom);
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
      if (capabilityMap) {
        const item = mapLayout.get(nodeId);
        if (!item) return;
        const container = document.getElementById('graph');
        mapTransform.x = container.clientWidth / 2 - (item.x + item.width / 2) * mapTransform.scale;
        mapTransform.y = container.clientHeight / 2 - (item.y + item.height / 2) * mapTransform.scale;
        applyMapTransform();
        selectMapItem(nodeId);
        return;
      }
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

    function edgeWidth(score) {
      const numeric = Number(score) || 1;
      return Math.max(1.4, Math.min(7, 1.2 + numeric * 0.42));
    }

    function exportGraph(format) {
      if (capabilityMap) {
        exportCapabilityMap(format);
        return;
      }
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

    function exportCapabilityMap(format) {
      if (!mapSvg || !capabilityMap) {
        vscode.postMessage({ type: 'graphExportFailed', reason: 'No capability map is currently visible.' });
        return;
      }

      try {
        const svg = serializeCapabilityMapSvg();
        if (format === 'svg') {
          vscode.postMessage({
            type: 'graphExported',
            format: 'svg',
            filename: workspaceState.exportBaseName + '.svg',
            text: svg
          });
          return;
        }

        const width = Number(mapSvg.getAttribute('width')) || 800;
        const height = Number(mapSvg.getAttribute('height')) || 600;
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(width * 2);
        canvas.height = Math.ceil(height * 2);
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        drawMapCanvas(ctx, capabilityMap.root, mapLayout);
        vscode.postMessage({
          type: 'graphExported',
          format: 'png',
          filename: workspaceState.exportBaseName + '.png',
          dataUri: canvas.toDataURL('image/png')
        });
      } catch (error) {
        vscode.postMessage({
          type: 'graphExportFailed',
          reason: error instanceof Error ? error.message : String(error)
        });
      }
    }

    function serializeCapabilityMapSvg() {
      const clone = mapSvg.cloneNode(true);
      const group = clone.querySelector('g');
      group?.setAttribute('transform', 'translate(24 24)');
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      const width = Number(mapSvg.getAttribute('width')) || 800;
      const height = Number(mapSvg.getAttribute('height')) || 600;
      const style = '<style>.map-context-rect{fill:#f6f8fa;stroke:#8c959f;stroke-width:1.2}.map-context-header{fill:#eaeef2;stroke:#8c959f;stroke-width:1}.map-context-label{fill:#24292f;font:700 13px Inter,Segoe UI,Arial,sans-serif}.map-tile{fill:#ffffff;stroke:#8c959f;stroke-width:1.2}.map-tile-title{fill:#24292f;font:700 12px Inter,Segoe UI,Arial,sans-serif}</style>';
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.ceil(width) + '" height="' + Math.ceil(height) + '" viewBox="0 0 ' + Math.ceil(width) + ' ' + Math.ceil(height) + '">',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        style,
        clone.innerHTML,
        '</svg>'
      ].join('');
    }

    function drawMapCanvas(ctx, root, layoutMap) {
      ctx.font = '700 13px Inter, Segoe UI, Arial, sans-serif';
      function drawContext(context) {
        if (context.synthetic) {
          for (const capability of context.capabilities || []) drawCapability(capability);
          for (const child of context.children || []) drawContext(child);
          return;
        }
        const box = layoutMap.get(context.id);
        if (!box) return;
        ctx.fillStyle = '#f6f8fa';
        ctx.strokeStyle = '#8c959f';
        roundRect(ctx, box.x + 24, box.y + 24, box.width, box.height, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#eaeef2';
        roundRect(ctx, box.x + 24, box.y + 24, box.width, 34, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#24292f';
        ctx.fillText(context.label, box.x + 38, box.y + 46);
        for (const capability of context.capabilities || []) drawCapability(capability);
        for (const child of context.children || []) drawContext(child);
      }
      function drawCapability(capability) {
        const box = layoutMap.get(capability.id);
        if (!box) return;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#8c959f';
        roundRect(ctx, box.x + 24, box.y + 24, box.width, box.height, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#24292f';
        ctx.font = '700 12px Inter, Segoe UI, Arial, sans-serif';
        for (const line of wrapWords(capability.label, 22).slice(0, 2)) {
          ctx.fillText(line.text, box.x + 36, box.y + 44 + line.index * 15);
        }
      }
      drawContext(root);
    }

    function roundRect(ctx, x, y, width, height, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
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
        '<line x1="' + round(x1) + '" y1="' + round(y1) + '" x2="' + round(x2) + '" y2="' + round(y2) + '" stroke="#6e7681" stroke-width="' + round(edge.data('edgeWidth') || 1.6) + '" marker-end="url(#arrow)"/>' +
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
      return '<g>' + shape + wrappedText(node.data('displayLabel') || node.data('label'), x + width / 2, y + height / 2) + '</g>';
    }

    function wrappedText(label, centerX, centerY) {
      const visible = wrapWords(label, 16).slice(0, 4).map((line) => line.text);
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

    function svgElement(name) {
      return document.createElementNS('http://www.w3.org/2000/svg', name);
    }

    function svgRect(x, y, width, height, radius, className) {
      const rect = svgElement('rect');
      rect.setAttribute('x', String(round(x)));
      rect.setAttribute('y', String(round(y)));
      rect.setAttribute('width', String(round(width)));
      rect.setAttribute('height', String(round(height)));
      rect.setAttribute('rx', String(radius));
      rect.classList.add(className);
      return rect;
    }

    function svgText(text, x, y, className, anchor = 'start') {
      const element = svgElement('text');
      element.setAttribute('x', String(round(x)));
      element.setAttribute('y', String(round(y)));
      element.setAttribute('text-anchor', anchor);
      element.classList.add(className);
      element.textContent = text;
      return element;
    }

    function wrapWords(label, maxLength) {
      const words = String(label || '').split(/\\s+/).filter(Boolean);
      const lines = [];
      let current = '';
      for (const word of words) {
        for (const part of splitLongWord(word, maxLength)) {
          const next = current ? current + ' ' + part : part;
          if (next.length > maxLength && current) {
            lines.push(current);
            current = part;
          } else {
            current = next;
          }
        }
      }
      if (current) lines.push(current);
      return lines.map((text, index) => ({ text, index }));
    }

    function splitLongWord(word, maxLength) {
      if (word.length <= maxLength) return [word];
      const parts = [];
      for (let index = 0; index < word.length; index += maxLength) parts.push(word.slice(index, index + maxLength));
      return parts;
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

    function updateEdgeDetails(edgeId) {
      const edge = edgeById.get(edgeId);
      if (!edge) return;
      document.getElementById('details-empty').classList.add('hidden');
      document.getElementById('details-content').classList.remove('hidden');
      document.getElementById('detail-label').textContent = edge.label;
      document.getElementById('detail-source-name').textContent = labelFor(edge.source) + ' -> ' + labelFor(edge.target);
      document.getElementById('detail-kind').textContent = edge.kind;
      document.getElementById('detail-relationships').textContent = edgeDetail(edge);
      document.getElementById('source-section').classList.add('hidden');
      document.getElementById('show-in-section').classList.add('hidden');
    }

    function edgeDetail(edge) {
      const reasons = edge.reasons || [];
      const score = typeof edge.score === 'number' ? edge.score : reasons.reduce((sum, reason) => sum + (Number(reason.score) || 0), 0);
      const breakdown = reasons.map((reason) => reason.label + ' +' + reason.score + ': ' + reason.detail);
      return ['Score ' + score, ...breakdown].join('; ');
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
        { selector: 'node', style: { 'label': 'data(label)', 'text-wrap': 'wrap', 'text-max-width': 118, 'text-overflow-wrap': 'whitespace', 'font-size': 11, 'color': '#d4d4d4', 'text-valign': 'center', 'text-halign': 'center', 'background-color': '#4f6bed', 'border-width': 1, 'border-color': '#9db0ff', 'width': 122, 'height': 68, 'shape': 'round-rectangle' } },
        { selector: 'node.capability, node.context, node.initial-step', style: { 'background-color': '#2ea043', 'border-color': '#7ee787', 'width': 138, 'height': 76, 'font-weight': 700 } },
        { selector: 'node.child-context, node.event', style: { 'background-color': '#1f9d8a', 'border-color': '#64d8cb' } },
        { selector: 'node.lifecycle', style: { 'background-color': '#8957e5', 'border-color': '#d2a8ff' } },
        { selector: 'node.rule', style: { 'background-color': '#d29922', 'border-color': '#f2cc60' } },
        { selector: 'node.effect', style: { 'background-color': '#db6d28', 'border-color': '#ffa657' } },
        { selector: 'node.policy, node.lifecycle-transition, node.terminal-step', style: { 'background-color': '#bf4b8a', 'border-color': '#ff9ece' } },
        { selector: 'node.external-context', style: { 'background-color': '#6e7681', 'border-color': '#9da7b3' } },
        { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#f2cc60', 'overlay-color': '#f2cc60', 'overlay-opacity': 0.16 } },
        { selector: 'edge', style: { 'label': 'data(label)', 'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'line-color': '#6e7681', 'target-arrow-color': '#6e7681', 'font-size': 9, 'color': '#9da7b3', 'text-background-color': editorBackground, 'text-background-opacity': 1, 'text-background-padding': 2, 'width': 'data(edgeWidth)' } },
        { selector: 'edge[kind *= "contains"], edge[kind = "begins"], edge[kind = "lifecycle-target"]', style: { 'line-style': 'dashed' } },
        { selector: 'edge[kind = "entry"]', style: { 'line-style': 'dashed', 'line-color': '#4f6bed', 'target-arrow-color': '#4f6bed', 'color': '#9db0ff', 'width': 1.2 } },
        { selector: 'edge:selected', style: { 'line-color': '#f2cc60', 'target-arrow-color': '#f2cc60', 'color': '#f2cc60', 'overlay-color': '#f2cc60', 'overlay-opacity': 0.16 } }
      ];
    }
  </script>
</body>
</html>`;
}
function renderEmptyHtml(title, message, canCompile) {
    const nonce = nonceValue();
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>DCL Graph Workspace</title><style nonce="${nonce}">html, body { height: 100%; margin: 0; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); }.toolbar { box-sizing: border-box; height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border-bottom: 1px solid var(--vscode-panel-border); }.toolbar-spacer { flex: 1; }button { border: 1px solid var(--vscode-button-border, transparent); border-radius: 3px; padding: 4px 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); font: inherit; cursor: pointer; }.empty-state { display: grid; place-items: center; height: calc(100vh - 48px); padding: 24px; box-sizing: border-box; text-align: center; }h1 { margin: 0 0 8px; font-size: 18px; }p { max-width: 560px; margin: 0 0 16px; color: var(--vscode-descriptionForeground); line-height: 1.5; }</style></head><body><header class="toolbar"><strong>DCL Graph Workspace</strong><span class="toolbar-spacer"></span><button id="refresh" type="button">Refresh</button><button id="compile-workspace" type="button"${canCompile ? "" : " disabled"}>Compile Workspace</button></header><main class="empty-state"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><button id="empty-compile" type="button"${canCompile ? "" : " disabled"}>Compile Workspace</button></div></main><script nonce="${nonce}">const vscode = acquireVsCodeApi();document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));document.getElementById('compile-workspace').addEventListener('click', () => vscode.postMessage({ type: 'compileWorkspace' }));document.getElementById('empty-compile').addEventListener('click', () => vscode.postMessage({ type: 'compileWorkspace' }));</script></body></html>`;
}
function isGraphWorkspaceMessage(message) {
    if (!message || typeof message !== "object")
        return false;
    const candidate = message;
    if (candidate.type === "refresh" || candidate.type === "compileWorkspace")
        return true;
    if (candidate.type === "graphExportFailed")
        return typeof candidate.reason === "string";
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
            && (candidate.architectureDetailLevel === undefined
                || candidate.architectureDetailLevel === "overview"
                || candidate.architectureDetailLevel === "detailed"
                || candidate.architectureDetailLevel === "full");
    }
    return false;
}
function isGraphWorkspaceType(value) {
    return value === "architecture"
        || value === "capability"
        || value === "capability-map"
        || value === "capability-influence"
        || value === "lifecycle"
        || value === "event-flow"
        || value === "context-map"
        || value === "cause-effect";
}
function isSemanticIdentity(value) {
    if (!value || typeof value !== "object")
        return false;
    const candidate = value;
    return typeof candidate.name === "string"
        && candidate.name.trim() !== ""
        && (candidate.kind === "capability"
            || candidate.kind === "context"
            || candidate.kind === "event"
            || candidate.kind === "effect"
            || candidate.kind === "policy"
            || candidate.kind === "lifecycle"
            || candidate.kind === "lifecycle-step"
            || candidate.kind === "lifecycle-transition");
}
function toWebviewGraph(graph, graphType) {
    return {
        ...graph,
        nodes: graph.nodes.map(({ source, ...node }) => ({
            ...node,
            wrappedLabel: (0, DclGraphLabels_1.wrapGraphLabel)(node.label, 16).map((line) => line.text).join("\n"),
            hasSource: Boolean(source),
        })),
        layoutPositions: graphType === "cause-effect" ? (0, DclCauseEffectLayout_1.causeEffectLayoutPositions)(graph) : undefined,
    };
}
function toWebviewCapabilityMap(map) {
    return {
        ...map,
        root: toWebviewCapabilityMapContext(map.root),
    };
}
function toWebviewCapabilityMapContext(context) {
    const { source, capabilities, children, ...rest } = context;
    return {
        ...rest,
        hasSource: Boolean(source),
        label: (0, DclGraphLabels_1.displayNameForGraph)(rest.name),
        sourceName: rest.name,
        capabilities: capabilities.map(toWebviewCapabilityMapCapability),
        children: children.map(toWebviewCapabilityMapContext),
    };
}
function toWebviewCapabilityMapCapability(capability) {
    const { source, ...rest } = capability;
    return {
        ...rest,
        hasSource: Boolean(source),
        label: (0, DclGraphLabels_1.displayNameForGraph)(rest.name),
        sourceName: rest.name,
    };
}
function toWebviewState(state) {
    const { graph: _graph, capabilityMap: _capabilityMap, ...rest } = state;
    return rest;
}
function optionsHtml(options, selected) {
    return options
        .map((option) => `<option value="${escapeHtml(option.value)}"${option.value === selected ? " selected" : ""}>${escapeHtml(option.label)}</option>`)
        .join("");
}
function legendItemsHtml(graph) {
    if (!graph)
        return "";
    return Array.from(new Set(graph.nodes.map((node) => node.kind)))
        .sort()
        .map((kind) => `<span class="legend-item"><span class="swatch ${escapeHtml(kind)}"></span>${escapeHtml(kind)}</span>`)
        .join("");
}
function capabilityMapLegendHtml() {
    return [
        `<span class="legend-item"><span class="swatch map-legend-context"></span>context container</span>`,
        `<span class="legend-item"><span class="swatch map-legend-capability"></span>capability tile</span>`,
    ].join("");
}
function statusText(graph, map) {
    if (graph) {
        return `${graph.nodes.length} nodes, ${graph.edges.length} relationships${graph.warnings?.length ? `, ${graph.warnings.length} warning${graph.warnings.length === 1 ? "" : "s"}` : ""}`;
    }
    if (map) {
        const items = (0, DclCapabilityMapBuilder_1.capabilityMapItems)(map);
        const contexts = items.filter((item) => item.kind === "context" && !item.synthetic).length;
        const capabilities = items.filter((item) => item.kind === "capability").length;
        return `${contexts} context container${contexts === 1 ? "" : "s"}, ${capabilities} capability tile${capabilities === 1 ? "" : "s"}${map.warnings?.length ? `, ${map.warnings.length} warning${map.warnings.length === 1 ? "" : "s"}` : ""}`;
    }
    return "No visual";
}
function escapeScriptJson(value) {
    return value === undefined ? "undefined" : JSON.stringify(value).replace(/</g, "\\u003c");
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
//# sourceMappingURL=DclGraphWorkspacePanel.js.map