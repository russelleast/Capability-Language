import * as vscode from "vscode";
import {
  CapabilityItemKind,
  CapabilitySummary,
  SemanticItem,
  SemanticSummary,
  SourceLocation,
  summarizeCompilerOutput,
} from "./semanticSummary";

type ExplorerNodeKind = "empty" | "group" | "capability" | "section" | "item";
type CapabilityListKind = Exclude<CapabilityItemKind, "lifecycle">;

export class DclExplorerNode extends vscode.TreeItem {
  constructor(
    label: string,
    readonly children: DclExplorerNode[] = [],
    readonly sourceLocation?: SourceLocation,
    kind: ExplorerNodeKind = "item",
    description?: string,
  ) {
    super(label, children.length ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
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

export class DclExplorerProvider implements vscode.TreeDataProvider<DclExplorerNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<DclExplorerNode | undefined | null | void>();
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

  getTreeItem(element: DclExplorerNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DclExplorerNode): vscode.ProviderResult<DclExplorerNode[]> {
    if (element) return element.children;
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
    ].filter((node): node is DclExplorerNode => Boolean(node && node.children.length > 0));

    return roots.length ? roots : [new DclExplorerNode("No semantic items in compiler output", [], undefined, "empty")];
  }
}

function capabilityNode(capability: CapabilitySummary): DclExplorerNode {
  const children = [
    sectionFromCapability("Intents", "intents", capability),
    sectionFromCapability("Actors", "actors", capability),
    sectionFromCapability("Outcomes", "outcomes", capability),
    sectionFromCapability("Rules", "rules", capability),
    sectionFromCapability("Effects", "effects", capability),
    sectionFromCapability("Events", "events", capability),
    sectionFromCapability("Policies", "policies", capability),
    lifecycleSection(capability),
  ].filter((node): node is DclExplorerNode => Boolean(node));

  return new DclExplorerNode(capability.name, children, capability.location, "capability", capability.context);
}

function sectionFromCapability(label: string, kind: CapabilityListKind, capability: CapabilitySummary): DclExplorerNode | undefined {
  const values = capability[kind];
  const children = values?.map((value: string) => itemNode(value, capability.itemLocations?.[kind]?.[value]));
  return section(label, children);
}

function lifecycleSection(capability: CapabilitySummary): DclExplorerNode | undefined {
  const lifecycle = capability.lifecycle;
  if (!lifecycle) return undefined;
  const items = [
    ...labelItems(lifecycle.begin ? [`begin ${lifecycle.begin}`] : undefined, capability.itemLocations?.lifecycle),
    ...labelItems(lifecycle.ends?.map((item) => `end ${item}`), capability.itemLocations?.lifecycle),
    ...labelItems(lifecycle.steps, capability.itemLocations?.lifecycle),
    ...labelItems(lifecycle.transitions, capability.itemLocations?.lifecycle),
  ];
  return section("Lifecycle", items);
}

function labelItems(items: string[] | undefined, locations: Record<string, SourceLocation> | undefined): DclExplorerNode[] {
  return (items ?? []).map((item) => itemNode(item, locations?.[item]));
}

function semanticItems(items: SemanticItem[] | undefined): DclExplorerNode[] | undefined {
  return items?.map((item) => itemNode(item.label, item.location));
}

function group(label: string, children: DclExplorerNode[] | undefined): DclExplorerNode | undefined {
  if (!children?.length) return undefined;
  return new DclExplorerNode(label, children, undefined, "group");
}

function section(label: string, children: DclExplorerNode[] | undefined): DclExplorerNode | undefined {
  if (!children?.length) return undefined;
  return new DclExplorerNode(label, children, undefined, "section");
}

function itemNode(label: string, location?: SourceLocation): DclExplorerNode {
  return new DclExplorerNode(label, [], location, "item");
}

function iconFor(kind: ExplorerNodeKind, label: string): vscode.ThemeIcon | undefined {
  if (kind === "empty") return new vscode.ThemeIcon("info");
  if (kind === "group") return new vscode.ThemeIcon("folder");
  if (kind === "capability") return new vscode.ThemeIcon("symbol-class");
  if (kind === "section") return new vscode.ThemeIcon(sectionIcon(label));
  return new vscode.ThemeIcon("symbol-field");
}

function sectionIcon(label: string): string {
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
