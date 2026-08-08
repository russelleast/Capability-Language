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
exports.DclCompletionProvider = void 0;
exports.authoredLanguageVersion = authoredLanguageVersion;
exports.completionLabels = completionLabels;
const vscode = __importStar(require("vscode"));
const DCL_10_TYPES = ["Text", "Boolean", "Number", "Date", "DateTime", "Uuid", "Email", "Money", "List<T>"];
const DCL_11_TYPES = [...DCL_10_TYPES, "Integer"];
function authoredLanguageVersion(text) {
    return /^\s*language\s+dcl\s+(\d+\.\d+)\b/m.exec(text)?.[1] ?? "1.1";
}
function completionLabels(text) {
    const labels = authoredLanguageVersion(text) === "1.0" ? [...DCL_10_TYPES] : [...DCL_11_TYPES];
    if (authoredLanguageVersion(text) === "1.1")
        labels.push("measure", "shape-enum");
    return labels;
}
class DclCompletionProvider {
    provideCompletionItems(document) {
        return completionLabels(document.getText()).map((label) => {
            const item = new vscode.CompletionItem(label, label === "measure" || label === "shape-enum" ? vscode.CompletionItemKind.Snippet : vscode.CompletionItemKind.TypeParameter);
            if (label === "measure") {
                item.insertText = new vscode.SnippetString("measure ${1:Quantity}");
                item.documentation = new vscode.MarkdownString("Declares a measured numeric unit. Since DCL 1.1.");
            }
            else if (label === "shape-enum") {
                item.insertText = new vscode.SnippetString("shape ${1:Result} enum {\n  ${2:Success}\n  ${3:Failed} is ${4:Failure}\n}");
                item.documentation = new vscode.MarkdownString("Declares an enum shape with optional typed cases. Since DCL 1.1.");
            }
            else {
                item.insertText = label;
                item.detail = "DCL built-in type";
            }
            return item;
        });
    }
}
exports.DclCompletionProvider = DclCompletionProvider;
//# sourceMappingURL=DclCompletionProvider.js.map