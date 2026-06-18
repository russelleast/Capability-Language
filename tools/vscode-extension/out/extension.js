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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const DclCompilerAdapter_1 = require("./compiler/DclCompilerAdapter");
const DclDiagnosticProvider_1 = require("./diagnostics/DclDiagnosticProvider");
const DclFormattingProvider_1 = require("./formatting/DclFormattingProvider");
const DclHoverProvider_1 = require("./hovers/DclHoverProvider");
const DclCapabilityGraphBuilder_1 = require("./graphs/DclCapabilityGraphBuilder");
const DclSourceLocation_1 = require("./source/DclSourceLocation");
const DclExplorerProvider_1 = require("./views/DclExplorerProvider");
const DclSummaryProvider_1 = require("./views/DclSummaryProvider");
const DclCapabilityGraphPanel_1 = require("./webviews/DclCapabilityGraphPanel");
const DCL_SELECTOR = { language: "dcl", scheme: "file" };
function activate(context) {
    const compiler = new DclCompilerAdapter_1.DclCompilerAdapter(vscode.workspace.workspaceFolders);
    const diagnostics = new DclDiagnosticProvider_1.DclDiagnosticProvider(compiler);
    const summary = new DclSummaryProvider_1.DclSummaryProvider();
    const explorer = new DclExplorerProvider_1.DclExplorerProvider();
    context.subscriptions.push(diagnostics, vscode.languages.registerHoverProvider(DCL_SELECTOR, new DclHoverProvider_1.DclHoverProvider()), vscode.languages.registerDocumentFormattingEditProvider(DCL_SELECTOR, new DclFormattingProvider_1.DclFormattingProvider(compiler)), vscode.window.registerTreeDataProvider("dclSemanticSummary", summary), vscode.window.registerTreeDataProvider("dclExplorer", explorer), vscode.commands.registerCommand("dcl.compileCurrentFile", () => compileCurrentFile(diagnostics, summary, explorer, false)), vscode.commands.registerCommand("dcl.compileWorkspace", () => compileWorkspace(diagnostics, summary, explorer)), vscode.commands.registerCommand("dcl.showSemanticSummary", () => compileCurrentFile(diagnostics, summary, explorer, true)), vscode.commands.registerCommand("dcl.formatDocument", () => vscode.commands.executeCommand("editor.action.formatDocument")), vscode.commands.registerCommand("dcl.refreshExplorer", () => refreshExplorer(diagnostics, summary, explorer)), vscode.commands.registerCommand("dcl.revealSemanticItemInSource", (location) => revealSemanticItemInSource(location)), vscode.commands.registerCommand("dcl.showCapabilityGraph", (node) => showCapabilityGraph(context.extensionUri, explorer, node)), vscode.workspace.onDidSaveTextDocument((document) => {
        const compileOnSave = vscode.workspace.getConfiguration("dcl").get("compileOnSave", true);
        if (compileOnSave && document.languageId === "dcl" && document.uri.scheme === "file") {
            void compileFiles([document.uri], diagnostics, summary, explorer, false, false);
        }
    }));
}
async function showCapabilityGraph(extensionUri, explorer, node) {
    const summary = explorer.getSummary();
    if (!summary?.capabilities.length) {
        DclCapabilityGraphPanel_1.DclCapabilityGraphPanel.showEmpty(extensionUri, "No Compiled Semantic Summary", "Compile DCL before opening a capability graph.");
        return;
    }
    let capabilityName = node?.kind === "capability" ? node.capabilityName : undefined;
    if (!capabilityName) {
        capabilityName = await pickCapability(summary);
    }
    if (!capabilityName) {
        DclCapabilityGraphPanel_1.DclCapabilityGraphPanel.showEmpty(extensionUri, "No Capability Selected", "Select a compiled capability to render its capability graph.", graphCapabilityPicks(summary), () => switchCapabilityGraph(extensionUri, explorer));
        return;
    }
    showGraphForCapability(extensionUri, explorer, summary, capabilityName);
}
async function switchCapabilityGraph(extensionUri, explorer) {
    const summary = explorer.getSummary();
    if (!summary?.capabilities.length) {
        DclCapabilityGraphPanel_1.DclCapabilityGraphPanel.showEmpty(extensionUri, "No Compiled Semantic Summary", "Compile DCL before switching capability graphs.");
        return;
    }
    const capabilityName = await pickCapability(summary);
    if (!capabilityName)
        return;
    showGraphForCapability(extensionUri, explorer, summary, capabilityName);
}
function showGraphForCapability(extensionUri, explorer, summary, capabilityName) {
    const graph = (0, DclCapabilityGraphBuilder_1.buildCapabilityGraph)(summary, capabilityName);
    if (!graph) {
        void vscode.window.showWarningMessage(`No compiler summary found for capability '${capabilityName}'.`);
        return;
    }
    DclCapabilityGraphPanel_1.DclCapabilityGraphPanel.show(extensionUri, graph, graphCapabilityPicks(summary), () => switchCapabilityGraph(extensionUri, explorer));
}
async function pickCapability(summary) {
    const picked = await vscode.window.showQuickPick(summary.capabilities.map((capability) => ({
        label: capability.name,
        description: capability.context,
    })), { title: "Select DCL Capability" });
    return picked?.label;
}
function graphCapabilityPicks(summary) {
    return summary.capabilities.map((capability) => ({
        name: capability.name,
        context: capability.context,
    }));
}
function deactivate() { }
async function compileCurrentFile(diagnostics, summary, explorer, revealSummary) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "dcl") {
        void vscode.window.showWarningMessage("Open a .dcl file before running this DCL command.");
        return;
    }
    await editor.document.save();
    await compileFiles([editor.document.uri], diagnostics, summary, explorer, revealSummary, true);
}
async function compileWorkspace(diagnostics, summary, explorer) {
    const files = await vscode.workspace.findFiles("**/*.dcl", "**/{node_modules,.git}/**");
    if (files.length === 0) {
        diagnostics.clear();
        summary.clear();
        explorer.showNoDclFiles();
        void vscode.window.showInformationMessage("No .dcl files found in this workspace.");
        return;
    }
    await compileFiles(files, diagnostics, summary, explorer, false, true);
}
async function refreshExplorer(diagnostics, summary, explorer) {
    const editor = vscode.window.activeTextEditor;
    if (editor?.document.languageId === "dcl" && editor.document.uri.scheme === "file") {
        await compileCurrentFile(diagnostics, summary, explorer, false);
        return;
    }
    await compileWorkspace(diagnostics, summary, explorer);
}
async function compileFiles(files, diagnostics, summary, explorer, revealSummary, showStatus) {
    try {
        const result = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Window,
            title: files.length === 1 ? "Compiling DCL file" : `Compiling ${files.length} DCL files`,
        }, () => diagnostics.compileFiles(files));
        if (result.ir) {
            summary.refresh(result.ir);
            explorer.refresh(result.ir);
        }
        else if (!result.ok) {
            summary.clear();
            explorer.showCompileFailed();
        }
        else {
            summary.clear();
            explorer.clear();
        }
        if (revealSummary) {
            await vscode.commands.executeCommand("dclSemanticSummary.focus");
        }
        if (showStatus) {
            const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
            const warnings = result.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
            const message = result.ok
                ? `DCL compile completed: ${warnings} warning${warnings === 1 ? "" : "s"}.`
                : `DCL compile failed: ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}.`;
            void vscode.window.showInformationMessage(message);
        }
    }
    catch (error) {
        diagnostics.clear();
        summary.clear();
        const message = error instanceof DclCompilerAdapter_1.DclCompilerError ? error.message : String(error);
        if (error instanceof DclCompilerAdapter_1.DclCompilerError && /unable to run dcl compiler/i.test(error.message)) {
            explorer.showCompilerUnavailable();
        }
        else {
            explorer.showCompileFailed();
        }
        void vscode.window.showErrorMessage(message);
    }
}
async function revealSemanticItemInSource(location) {
    const result = await (0, DclSourceLocation_1.revealSourceLocation)(location, "oneBased");
    if (!result.ok) {
        void vscode.window.showWarningMessage(result.reason);
    }
}
//# sourceMappingURL=extension.js.map