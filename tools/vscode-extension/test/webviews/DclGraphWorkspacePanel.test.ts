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
    edges: [],
  };
}
