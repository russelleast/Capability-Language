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
exports.languages = exports.window = exports.workspace = exports.Uri = exports.EventEmitter = exports.TextEditorRevealType = exports.TreeItem = exports.TreeItemCollapsibleState = exports.ThemeIcon = exports.Diagnostic = exports.DiagnosticSeverity = exports.Selection = exports.Range = exports.Position = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class Position {
    constructor(line, character) {
        this.line = line;
        this.character = character;
    }
}
exports.Position = Position;
class Range {
    constructor(startLine, startCharacter, endLine, endCharacter) {
        this.start = new Position(startLine, startCharacter);
        this.end = new Position(endLine, endCharacter);
    }
}
exports.Range = Range;
class Selection extends Range {
}
exports.Selection = Selection;
var DiagnosticSeverity;
(function (DiagnosticSeverity) {
    DiagnosticSeverity[DiagnosticSeverity["Error"] = 0] = "Error";
    DiagnosticSeverity[DiagnosticSeverity["Warning"] = 1] = "Warning";
    DiagnosticSeverity[DiagnosticSeverity["Information"] = 2] = "Information";
    DiagnosticSeverity[DiagnosticSeverity["Hint"] = 3] = "Hint";
})(DiagnosticSeverity || (exports.DiagnosticSeverity = DiagnosticSeverity = {}));
class Diagnostic {
    constructor(range, message, severity) {
        this.range = range;
        this.message = message;
        this.severity = severity;
    }
}
exports.Diagnostic = Diagnostic;
class ThemeIcon {
    constructor(id) {
        this.id = id;
    }
}
exports.ThemeIcon = ThemeIcon;
var TreeItemCollapsibleState;
(function (TreeItemCollapsibleState) {
    TreeItemCollapsibleState[TreeItemCollapsibleState["None"] = 0] = "None";
    TreeItemCollapsibleState[TreeItemCollapsibleState["Collapsed"] = 1] = "Collapsed";
    TreeItemCollapsibleState[TreeItemCollapsibleState["Expanded"] = 2] = "Expanded";
})(TreeItemCollapsibleState || (exports.TreeItemCollapsibleState = TreeItemCollapsibleState = {}));
class TreeItem {
    constructor(label, collapsibleState = TreeItemCollapsibleState.None) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}
exports.TreeItem = TreeItem;
var TextEditorRevealType;
(function (TextEditorRevealType) {
    TextEditorRevealType[TextEditorRevealType["Default"] = 0] = "Default";
    TextEditorRevealType[TextEditorRevealType["InCenter"] = 1] = "InCenter";
    TextEditorRevealType[TextEditorRevealType["InCenterIfOutsideViewport"] = 2] = "InCenterIfOutsideViewport";
    TextEditorRevealType[TextEditorRevealType["AtTop"] = 3] = "AtTop";
})(TextEditorRevealType || (exports.TextEditorRevealType = TextEditorRevealType = {}));
class EventEmitter {
    constructor() {
        this.event = () => undefined;
    }
    fire(_value) { }
}
exports.EventEmitter = EventEmitter;
class Uri {
    constructor(fsPath) {
        this.fsPath = fsPath;
    }
    static file(file) {
        return new Uri(path.resolve(file));
    }
    static joinPath(base, ...segments) {
        return new Uri(path.join(base.fsPath, ...segments));
    }
}
exports.Uri = Uri;
exports.workspace = {
    workspaceFolders: [],
    compilerPath: "",
    files: [],
    getConfiguration(_section) {
        return {
            get(_key, defaultValue) {
                return (exports.workspace.compilerPath || defaultValue);
            },
        };
    },
    async findFiles() {
        return exports.workspace.files;
    },
    async openTextDocument(uri) {
        const text = fs.readFileSync(uri.fsPath, "utf8");
        const lines = text.split(/\r?\n/);
        return {
            uri,
            lineCount: lines.length,
            lineAt(line) {
                const value = lines[line] ?? "";
                return {
                    text: value,
                    range: new Range(line, 0, line, value.length),
                };
            },
        };
    },
};
exports.window = {
    lastShownDocument: undefined,
    async showTextDocument(document) {
        exports.window.lastShownDocument = document;
        return {
            selection: undefined,
            revealRange(_range, _type) { },
        };
    },
    showWarningMessage(_message) { },
    showErrorMessage(_message) { },
    showInformationMessage(_message) { },
    registerTreeDataProvider() {
        return { dispose() { } };
    },
};
exports.languages = {
    createDiagnosticCollection() {
        const entries = new Map();
        return {
            entries,
            set(uri, diagnostics) {
                entries.set(uri.fsPath, diagnostics);
            },
            clear() {
                entries.clear();
            },
            dispose() {
                entries.clear();
            },
        };
    },
};
//# sourceMappingURL=vscode.js.map