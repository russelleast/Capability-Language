import * as vscode from "vscode";
import { SemanticSummary, summarizeCompilerOutput } from "./semanticSummary";

type SummaryNodeKind = "root" | "group" | "item";

class SummaryNode extends vscode.TreeItem {
  constructor(
    label: string,
    readonly children: SummaryNode[] = [],
    kind: SummaryNodeKind = "item",
    description?: string,
  ) {
    super(label, children.length ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.contextValue = `dclSummary.${kind}`;
  }
}

export class DclSummaryProvider implements vscode.TreeDataProvider<SummaryNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<SummaryNode | undefined | null | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  private summary: SemanticSummary | undefined;

  refresh(ir: unknown | undefined): void {
    this.summary = ir ? summarizeCompilerOutput(ir) : undefined;
    this.onDidChangeTreeDataEmitter.fire();
  }

  clear(): void {
    this.summary = undefined;
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: SummaryNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SummaryNode): vscode.ProviderResult<SummaryNode[]> {
    if (element) return element.children;
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
      group("Actors", labels(this.summary.actors?.map((item) => item.label))),
      group("Policies", labels(this.summary.policies?.map((item) => item.label))),
      group("Effects", labels(this.summary.effects?.map((item) => item.label))),
      group("Events", labels(this.summary.events?.map((item) => item.label))),
      group("Lifecycles", labels(this.summary.lifecycles?.map((item) => item.label))),
    ].filter((node) => node.children.length > 0);
  }
}

function group(label: string, children: SummaryNode[] | undefined): SummaryNode {
  return new SummaryNode(label, children ?? [], "group");
}

function groupItems(label: string, items: string[] | undefined): SummaryNode[] {
  return items?.length ? [group(label, labels(items))] : [];
}

function labels(items: string[] | undefined): SummaryNode[] {
  return (items ?? []).map((item) => new SummaryNode(item));
}
