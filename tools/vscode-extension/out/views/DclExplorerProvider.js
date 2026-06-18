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
exports.DclExplorerProvider = exports.DclExplorerNode = void 0;
const vscode = __importStar(require("vscode"));
const semanticSummary_1 = require("./semanticSummary");
class DclExplorerNode extends vscode.TreeItem {
    constructor(label, children = [], sourceLocation, kind = "item", description, capabilityName, eventName, contextValue) {
        super(label, children.length ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
        this.children = children;
        this.sourceLocation = sourceLocation;
        this.kind = kind;
        this.capabilityName = capabilityName;
        this.eventName = eventName;
        this.description = description;
        this.contextValue = contextValue ?? `dclExplorer.${kind}${sourceLocation ? ".located" : ""}`;
        this.tooltip = sourceLocation?.file ? `${label}\n${sourceLocation.file}:${sourceLocation.line}:${sourceLocation.column ?? 1}` : label;
        this.iconPath = iconFor(kind, label);
        if (sourceLocation) {
            this.command = {
                command: "dcl.revealSemanticItemInSource",
                title: "Reveal in Source",
                arguments: [sourceLocation],
            };
        }
    }
}
exports.DclExplorerNode = DclExplorerNode;
class DclExplorerProvider {
    constructor() {
        this.onDidChangeTreeDataEmitter = new vscode.EventEmitter();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
        this.state = { kind: "empty", message: "No compiled summary yet. Run DCL: Compile Workspace or DCL: Refresh Explorer." };
    }
    refresh(ir) {
        try {
            this.state = ir
                ? { kind: "summary", summary: (0, semanticSummary_1.summarizeCompilerOutput)(ir) }
                : { kind: "empty", message: "No semantic summary was returned by the compiler." };
        }
        catch {
            this.state = { kind: "empty", message: "Compiler summary could not be displayed." };
        }
        this.onDidChangeTreeDataEmitter.fire();
    }
    clear() {
        this.setEmpty("No compiled summary yet. Run DCL: Compile Workspace or DCL: Refresh Explorer.");
    }
    showCompileFailed() {
        this.setEmpty("Compile failed. Fix compiler diagnostics and refresh the explorer.");
    }
    showNoDclFiles() {
        this.setEmpty("No DCL files found in this workspace.");
    }
    showCompilerUnavailable() {
        this.setEmpty("DCL compiler unavailable. Check dcl.compilerPath and refresh the explorer.");
    }
    showInvalidSummary() {
        this.setEmpty("Compiler summary could not be displayed.");
    }
    setEmpty(message) {
        this.state = { kind: "empty", message };
        this.onDidChangeTreeDataEmitter.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getSummary() {
        return this.state.kind === "summary" ? this.state.summary : undefined;
    }
    getChildren(element) {
        if (element)
            return element.children;
        if (this.state.kind === "empty") {
            return [new DclExplorerNode(this.state.message, [], undefined, "empty")];
        }
        const summary = this.state.summary;
        const roots = [
            group("Contexts", summary.contexts?.map((context) => {
                const dependencies = section("Dependencies", context.dependencies?.map((item) => itemNode(item)));
                return new DclExplorerNode(context.name, dependencies ? [dependencies] : [], context.location, "item");
            })),
            group("Capabilities", summary.capabilities.map(capabilityNode)),
            group("Actors", semanticItems(summary.actors)),
            group("Policies", semanticItems(summary.policies)),
            group("Effects", semanticItems(summary.effects)),
            group("Events", semanticItems(summary.events, "event"), "dclExplorer.events"),
            group("Lifecycles", semanticItems(summary.lifecycles)),
        ].filter((node) => Boolean(node && node.children.length > 0));
        return roots.length ? roots : [new DclExplorerNode("No semantic items in compiler output", [], undefined, "empty")];
    }
}
exports.DclExplorerProvider = DclExplorerProvider;
function capabilityNode(capability) {
    const children = [
        sectionFromCapability("Intents", "intents", capability),
        sectionFromCapability("Actors", "actors", capability),
        sectionFromCapability("Outcomes", "outcomes", capability),
        sectionFromCapability("Rules", "rules", capability),
        sectionFromCapability("Effects", "effects", capability),
        eventsSection(capability),
        sectionFromCapability("Policies", "policies", capability),
        lifecycleSection(capability),
    ].filter((node) => Boolean(node));
    const contextValue = `dclExplorer.capability${capability.location ? ".located" : ""}${capability.lifecycle ? ".lifecycle" : ""}${capability.eventDetails?.length ? ".events" : ""}`;
    return new DclExplorerNode(capability.name, children, capability.location, "capability", capability.context, capability.name, undefined, contextValue);
}
function sectionFromCapability(label, kind, capability) {
    const values = capability[kind];
    const children = values?.map((value) => itemNode(value, capability.itemLocations?.[kind]?.[value]));
    return section(label, children);
}
function lifecycleSection(capability) {
    const lifecycle = capability.lifecycle;
    if (!lifecycle)
        return undefined;
    const items = [
        ...labelItems(lifecycle.begin ? [`begin ${lifecycle.begin}`] : undefined, capability.itemLocations?.lifecycle),
        ...labelItems(lifecycle.ends?.map((item) => `end ${item}`), capability.itemLocations?.lifecycle),
        ...labelItems(lifecycle.steps, capability.itemLocations?.lifecycle),
        ...labelItems(lifecycle.transitions, capability.itemLocations?.lifecycle),
    ];
    return new DclExplorerNode("Lifecycle", items, undefined, "lifecycle", undefined, capability.name);
}
function eventsSection(capability) {
    const details = capability.eventDetails;
    const children = details?.map((event) => eventNode(event.label, capability.itemLocations?.events?.[event.label] ?? capability.itemLocations?.events?.[event.event], capability.name, event.event));
    if (children?.length)
        return section("Events", children);
    return sectionFromCapability("Events", "events", capability);
}
function labelItems(items, locations) {
    return (items ?? []).map((item) => itemNode(item, locations?.[item]));
}
function semanticItems(items, kind = "item") {
    return items?.map((item) => kind === "event" ? eventNode(item.label, item.location, undefined, item.label) : itemNode(item.label, item.location));
}
function group(label, children, contextValue) {
    if (!children?.length)
        return undefined;
    return new DclExplorerNode(label, children, undefined, "group", undefined, undefined, undefined, contextValue);
}
function section(label, children) {
    if (!children?.length)
        return undefined;
    return new DclExplorerNode(label, children, undefined, "section");
}
function itemNode(label, location) {
    return new DclExplorerNode(label, [], location, "item");
}
function eventNode(label, location, capabilityName, eventName) {
    return new DclExplorerNode(label, [], location, "event", capabilityName, capabilityName, eventName);
}
function iconFor(kind, label) {
    if (kind === "empty")
        return new vscode.ThemeIcon("info");
    if (kind === "group")
        return new vscode.ThemeIcon("folder");
    if (kind === "capability")
        return new vscode.ThemeIcon("symbol-class");
    if (kind === "lifecycle")
        return new vscode.ThemeIcon("git-branch");
    if (kind === "event")
        return new vscode.ThemeIcon("symbol-event");
    if (kind === "section")
        return new vscode.ThemeIcon(sectionIcon(label));
    return new vscode.ThemeIcon("symbol-field");
}
function sectionIcon(label) {
    switch (label) {
        case "Intents":
            return "target";
        case "Outcomes":
            return "symbol-event";
        case "Rules":
            return "law";
        case "Effects":
            return "plug";
        case "Events":
            return "radio-tower";
        case "Policies":
            return "shield";
        case "Lifecycle":
            return "git-branch";
        default:
            return "list-tree";
    }
}
//# sourceMappingURL=DclExplorerProvider.js.map