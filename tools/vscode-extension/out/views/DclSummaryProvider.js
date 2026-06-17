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
exports.DclSummaryProvider = void 0;
const vscode = __importStar(require("vscode"));
const semanticSummary_1 = require("./semanticSummary");
class SummaryNode extends vscode.TreeItem {
    constructor(label, children = [], kind = "item", description) {
        super(label, children.length ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
        this.children = children;
        this.description = description;
        this.contextValue = `dclSummary.${kind}`;
    }
}
class DclSummaryProvider {
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
            return [new SummaryNode("Run DCL: Show Semantic Summary", [], "item")];
        }
        return [
            group("Contexts", this.summary.contexts?.map((context) => {
                const children = groupItems("Dependencies", context.dependencies);
                return new SummaryNode(context.name, children, "item");
            })),
            group("Capabilities", this.summary.capabilities.map((capability) => {
                const children = [
                    group("Actors", labels(capability.actors)),
                    group("Outcomes", labels(capability.outcomes)),
                    group("Policies", labels(capability.policies)),
                    group("Effects", labels(capability.effects)),
                    group("Events", labels(capability.events)),
                    group("Lifecycle", [
                        ...labels(capability.lifecycle?.begin ? [`begin ${capability.lifecycle.begin}`] : undefined),
                        ...labels(capability.lifecycle?.ends?.map((item) => `end ${item}`)),
                        ...labels(capability.lifecycle?.steps),
                        ...labels(capability.lifecycle?.transitions),
                    ]),
                ].filter((node) => node.children.length > 0);
                return new SummaryNode(capability.name, children, "item", capability.context);
            })),
            group("Actors", labels(this.summary.actors)),
            group("Policies", labels(this.summary.policies)),
            group("Effects", labels(this.summary.effects)),
            group("Events", labels(this.summary.events)),
            group("Lifecycles", labels(this.summary.lifecycles)),
        ].filter((node) => node.children.length > 0);
    }
}
exports.DclSummaryProvider = DclSummaryProvider;
function group(label, children) {
    return new SummaryNode(label, children ?? [], "group");
}
function groupItems(label, items) {
    return items?.length ? [group(label, labels(items))] : [];
}
function labels(items) {
    return (items ?? []).map((item) => new SummaryNode(item));
}
//# sourceMappingURL=DclSummaryProvider.js.map