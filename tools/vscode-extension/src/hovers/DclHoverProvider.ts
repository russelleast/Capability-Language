import * as vscode from "vscode";

export const HOVERS: Record<string, string> = {
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

export class DclHoverProvider implements vscode.HoverProvider {
  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
    if (!range) return undefined;
    const word = document.getText(range);
    const help = HOVERS[word];
    if (!help) return undefined;

    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`**${word}**\n\n${help}`);
    return new vscode.Hover(markdown, range);
  }
}
