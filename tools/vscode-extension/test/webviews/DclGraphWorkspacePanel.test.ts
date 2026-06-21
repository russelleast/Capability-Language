import * as path from "path";
import * as vscode from "vscode";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DclGraphModel } from "../../src/graphs/DclGraphModel";
import { DclGraphWorkspaceState } from "../../src/graphs/DclGraphWorkspaceState";
import { DclGraphWorkspacePanel } from "../../src/webviews/DclGraphWorkspacePanel";

describe("DclGraphWorkspacePanel", () => {
  afterEach(() => {
    for (const panel of [...vscode.window.createdWebviewPanels]) {
      panel.dispose();
    }
    vscode.window.createdWebviewPanels.length = 0;
    vscode.window.lastShownDocument = undefined;
    vscode.workspace.workspaceFolders = [];
  });

  it("opens in the active editor column and reuses the existing panel", () => {
    const callbacks = callbacksMock();

    DclGraphWorkspacePanel.show(extensionUri(), workspaceState("architecture"), callbacks);
    DclGraphWorkspacePanel.show(extensionUri(), workspaceState("capability"), callbacks);

    expect(vscode.window.createdWebviewPanels).toHaveLength(1);
    expect(vscode.window.createdWebviewPanels[0].showOptions).toBe(vscode.ViewColumn.Active);
    expect(vscode.window.createdWebviewPanels[0].revealCalls).toEqual([vscode.ViewColumn.Active]);
  });

  it("does not reveal source for ordinary node selection", () => {
    DclGraphWorkspacePanel.show(extensionUri(), workspaceState("architecture"), callbacksMock());
    const panel = vscode.window.createdWebviewPanels[0];

    panel.webview.emitMessage({ type: "nodeSelected", nodeId: "capability:acceptorder" });

    expect(vscode.window.lastShownDocument).toBeUndefined();
  });

  it("renders compact accessible graph action controls without putting counts in the toolbar row", () => {
    DclGraphWorkspacePanel.show(extensionUri(), workspaceState("architecture"), callbacksMock());
    const html = vscode.window.createdWebviewPanels[0].webview.html;

    expect(html).toContain('class="action-group" aria-label="Graph actions"');
    expect(html).toContain('id="refresh" type="button" title="Refresh graph data" aria-label="Refresh graph data">↻</button>');
    expect(html).toContain('id="compile-workspace" class="primary" type="button" title="Compile workspace" aria-label="Compile workspace">Compile</button>');
    expect(html).toContain('id="export-svg" type="button" title="Export graph as SVG" aria-label="Export graph as SVG">SVG</button>');
    expect(html).toContain('id="export-png" type="button" title="Export graph as PNG" aria-label="Export graph as PNG">PNG</button>');
    expect(html).toContain('id="fit-graph" type="button" title="Fit graph to view" aria-label="Fit graph to view">Fit</button>');
    expect(html).toContain('id="reset-layout" type="button" title="Reset graph layout" aria-label="Reset graph layout">Reset</button>');
    expect(html).toContain('id="center-selection" type="button" title="Center selected node" aria-label="Center selected node">Center</button>');
    expect(html).toContain('<div class="graph-status" aria-live="polite">1 nodes, 1 relationships</div>');
    expect(html).not.toContain('class="counts"');
  });

  it("keeps toolbar action message and export mappings available", () => {
    DclGraphWorkspacePanel.show(extensionUri(), workspaceState("architecture"), callbacksMock());
    const html = vscode.window.createdWebviewPanels[0].webview.html;

    expect(html).toContain("document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }))");
    expect(html).toContain("document.getElementById('compile-workspace').addEventListener('click', () => vscode.postMessage({ type: 'compileWorkspace' }))");
    expect(html).toContain("document.getElementById('export-svg').addEventListener('click', () => exportGraph('svg'))");
    expect(html).toContain("document.getElementById('export-png').addEventListener('click', () => exportGraph('png'))");
    expect(html).toContain("document.getElementById('fit-graph').addEventListener('click', () => fitVisible())");
    expect(html).toContain("document.getElementById('reset-layout').addEventListener('click', () => runLayout(true))");
    expect(html).toContain("document.getElementById('center-selection').addEventListener('click', () => centerSelection())");
  });

  it("requests export from the visible graph panel", async () => {
    DclGraphWorkspacePanel.show(extensionUri(), workspaceState("architecture"), callbacksMock());
    const panel = vscode.window.createdWebviewPanels[0];

    await DclGraphWorkspacePanel.exportCurrentGraph("svg");

    expect(panel.webview.postedMessages).toContainEqual({ type: "requestExport", format: "svg" });
  });

  it("reveals source only when the webview sends an explicit source action", async () => {
    const sourceFile = path.join(__dirname, "..", "..", "test-fixtures", "valid-basic.dcl");
    vscode.workspace.workspaceFolders = [{ uri: vscode.Uri.file(path.dirname(sourceFile)) }];
    const callbacks = callbacksMock();
    DclGraphWorkspacePanel.show(extensionUri(), workspaceState("architecture", sourceFile), callbacks);
    const panel = vscode.window.createdWebviewPanels[0];

    panel.webview.emitMessage({ type: "revealSource", nodeId: "capability:acceptorder" });

    await vi.waitFor(() => expect(callbacks.onRevealSource).toHaveBeenCalledWith({ file: sourceFile, line: 1, column: 1 }));
    expect(vscode.window.lastShownDocument).toBeUndefined();
  });
});

function callbacksMock() {
  return {
    onSelectionChanged: vi.fn(),
    onRefresh: vi.fn(),
    onCompileWorkspace: vi.fn(),
    onRevealSource: vi.fn(),
  };
}

function extensionUri(): vscode.Uri {
  return vscode.Uri.file(path.join(__dirname, "..", ".."));
}

function workspaceState(graphType: DclGraphWorkspaceState["graphType"], sourceFile?: string): DclGraphWorkspaceState {
  return {
    graphType,
    graphTypes: [
      { label: "Architecture Overview", value: "architecture" },
      { label: "Capability Graph", value: "capability" },
    ],
    subjects: [],
    architectureDetailLevel: "overview",
    graph: graph(sourceFile),
    graphSyncTargets: {},
    exportBaseName: "dcl-test-graph",
  };
}

function graph(sourceFile?: string): DclGraphModel {
  return {
    title: "DCL Test Graph",
    nodes: [{
      id: "capability:acceptorder",
      label: "Accept Order",
      sourceName: "AcceptOrder",
      kind: "capability",
      source: sourceFile ? { file: sourceFile, line: 1, column: 1 } : undefined,
    }],
    edges: [{
      id: "edge:acceptorder:accepted",
      source: "capability:acceptorder",
      target: "capability:acceptorder",
      label: "emits",
      kind: "emits",
    }],
  };
}
