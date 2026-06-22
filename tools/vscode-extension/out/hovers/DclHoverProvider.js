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
exports.DclHoverProvider = exports.HOVERS = void 0;
const vscode = __importStar(require("vscode"));
exports.HOVERS = {
    language: "Declares the DCL language version for the file.",
    context: "Groups DCL declarations and controls cross-context visibility through explicit dependencies.",
    capability: "The core DCL unit: a named business capability with intent, outcomes, effects, policies, and optional lifecycle.",
    actor: "Declares a participant that can initiate or participate in capabilities. Valid DCL v1.0 actor types are human, system, agent, and scheduled_process.",
    shape: "Declares structured input or payload data used by intents and events.",
    event: "Declares a named signal with an optional payload.",
    effect: "Declares an externally meaningful action. Valid DCL v1.0 effect types are persistence, notification, invocation, and tool.",
    policy: "Declares architectural constraints, obligations, and thresholds in grouped family blocks, for example policy InvoiceExecution { performance { ... } confidence { threshold 0.8 } }.",
    agent: "Actor kind for an autonomous or semi-autonomous reasoning participant.",
    tool: "Effect kind for a declared tool-use boundary such as an MCP tool, function call, retrieval tool, or agent tool.",
    confidence: "Policy family for a numeric confidence threshold between 0 and 1. It is not a full LLM evaluation model.",
    threshold: "Numeric confidence policy threshold. Values must be between 0 and 1.",
    intent: "Declares the input shape and actor that initiate a capability.",
    outcome: "Declares a possible result produced by a capability.",
    rule: "Declares an invariant or condition used by capability outcome logic.",
    when: "Maps compiler-visible conditions to capability outcomes. Use always Outcome for unconditional outcome causation.",
    lifecycle: "Declares lifecycle states and transitions for a capability.",
    supervises: "Declares a lifecycle that coordinates contributing capabilities.",
    begin: "Declares the initial lifecycle state.",
    step: "Declares a lifecycle state, optionally with waits, decisions, deadlines, or recovery.",
    end: "Declares a terminal lifecycle state.",
    move: "Declares a lifecycle transition.",
    emits: "Declares that a capability emits an event.",
    governs: "Attaches a policy to a capability, effect, event, outcome, or lifecycle.",
    applies: "Alias for attaching a policy to a semantic boundary.",
};
class DclHoverProvider {
    provideHover(document, position) {
        const range = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
        if (!range)
            return undefined;
        const word = document.getText(range);
        const help = exports.HOVERS[word];
        if (!help)
            return undefined;
        const markdown = new vscode.MarkdownString();
        markdown.appendMarkdown(`**${word}**\n\n${help}`);
        return new vscode.Hover(markdown, range);
    }
}
exports.DclHoverProvider = DclHoverProvider;
//# sourceMappingURL=DclHoverProvider.js.map