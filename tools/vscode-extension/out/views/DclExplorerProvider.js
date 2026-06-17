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
    constructor(label, children = [], sourceLocation, kind = "item", description) {
        super(label, children.length ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
        this.children = children;
        this.sourceLocation = sourceLocation;
        this.description = description;
        this.contextValue = `dclExplorer.${kind}${sourceLocation ? ".located" : ""}`;
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
    }
    refresh(ir) {
        this.summary = ir ? (0, semanticSummary_1.summarizeCompilerOutput)(ir) : undefined;
        this.onDidChangeTreeDataEmitter.fire();
    }
    clear() {
        this.summary = undefined;
        this.onDidChangeTreeDataEmitter.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (element)
            return element.children;
        if (!this.summary) {
            return [new DclExplorerNode("Compile DCL to populate the explorer", [], undefined, "empty")];
        }
        const roots = [
            group("Contexts", this.summary.contexts?.map((context) => {
                const dependencies = section("Dependencies", context.dependencies?.map((item) => itemNode(item)));
                return new DclExplorerNode(context.name, dependencies ? [dependencies] : [], context.location, "item");
            })),
            group("Capabilities", this.summary.capabilities.map(capabilityNode)),
            group("Actors", semanticItems(this.summary.actors)),
            group("Policies", semanticItems(this.summary.policies)),
            group("Effects", semanticItems(this.summary.effects)),
            group("Events", semanticItems(this.summary.events)),
            group("Lifecycles", semanticItems(this.summary.lifecycles)),
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
        sectionFromCapability("Events", "events", capability),
        sectionFromCapability("Policies", "policies", capability),
        lifecycleSection(capability),
    ].filter((node) => Boolean(node));
    return new DclExplorerNode(capability.name, children, capability.location, "capability", capability.context);
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
    return section("Lifecycle", items);
}
function labelItems(items, locations) {
    return (items ?? []).map((item) => itemNode(item, locations?.[item]));
}
function semanticItems(items) {
    return items?.map((item) => itemNode(item.label, item.location));
}
function group(label, children) {
    if (!children?.length)
        return undefined;
    return new DclExplorerNode(label, children, undefined, "group");
}
function section(label, children) {
    if (!children?.length)
        return undefined;
    return new DclExplorerNode(label, children, undefined, "section");
}
function itemNode(label, location) {
    return new DclExplorerNode(label, [], location, "item");
}
function iconFor(kind, label) {
    if (kind === "empty")
        return new vscode.ThemeIcon("info");
    if (kind === "group")
        return new vscode.ThemeIcon("folder");
    if (kind === "capability")
        return new vscode.ThemeIcon("symbol-class");
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