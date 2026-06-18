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
exports.DclFormattingProvider = void 0;
const vscode = __importStar(require("vscode"));
const DclCompilerAdapter_1 = require("../compiler/DclCompilerAdapter");
class DclFormattingProvider {
    constructor(compiler) {
        this.compiler = compiler;
    }
    async provideDocumentFormattingEdits(document) {
        try {
            const formatted = await this.compiler.formatFile(document.uri);
            if (formatted === document.getText())
                return [];
            const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
            return [vscode.TextEdit.replace(fullRange, formatted)];
        }
        catch (error) {
            const message = error instanceof DclCompilerAdapter_1.DclCompilerError ? error.message : String(error);
            void vscode.window.showWarningMessage(message);
            return [];
        }
    }
}
exports.DclFormattingProvider = DclFormattingProvider;
//# sourceMappingURL=DclFormattingProvider.js.map