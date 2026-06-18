import * as vscode from "vscode";
import {
  CapabilityItemKind,
  CapabilitySummary,
  SemanticItem,
  SemanticSummary,
  SourceLocation,
  summarizeCompilerOutput,
} from "./semanticSummary";

type ExplorerNodeKind = "empty" | "group" | "context" | "capability" | "lifecycle" | "event" | "section" | "item";
type CapabilityListKind = Exclude<CapabilityItemKind, "lifecycle">;
type ExplorerState =
  | { kind: "empty"; message: string }
  | { kind: "summary"; summary: SemanticSummary };

export class DclExplorerNode extends vscode.TreeItem {
  constructor(
    label: string,
    readonly children: DclExplorerNode[] = [],
    readonly sourceLocation?: SourceLocation,
    readonly kind: ExplorerNodeKind = "item",
    description?: string,
    readonly capabilityName?: string,
    readonly eventName?: string,
    contextValue?: string,
  ) {
    super(label, children.length ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
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

export class DclExplorerProvider implements vscode.TreeDataProvider<DclExplorerNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<DclExplorerNode | undefined | null | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  private state: ExplorerState = { kind: "empty", message: "No compiled summary yet. Run DCL: Compile Workspace or DCL: Refresh Explorer." };

  refresh(ir: unknown | undefined): void {
    try {
      this.state = ir
        ? { kind: "summary", summary: summarizeCompilerOutput(ir) }
        : { kind: "empty", message: "No semantic summary was returned by the compiler." };
    } catch {
      this.state = { kind: "empty", message: "Compiler summary could not be displayed." };
    }
    this.onDidChangeTreeDataEmitter.fire();
  }

  clear(): void {
    this.setEmpty("No compiled summary yet. Run DCL: Compile Workspace or DCL: Refresh Explorer.");
  }

  showCompileFailed(): void {
    this.setEmpty("Compile failed. Fix compiler diagnostics and refresh the explorer.");
  }

  showNoDclFiles(): void {
    this.setEmpty("No DCL files found in this workspace.");
  }

  showCompilerUnavailable(): void {
    this.setEmpty("DCL compiler unavailable. Check dcl.compilerPath and refresh the explorer.");
  }

  showInvalidSummary(): void {
    this.setEmpty("Compiler summary could not be displayed.");
  }

  private setEmpty(message: string): void {
    this.state = { kind: "empty", message };
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: DclExplorerNode): vscode.TreeItem {
    return element;
  }

  getSummary(): SemanticSummary | undefined {
    return this.state.kind === "summary" ? this.state.summary : undefined;
  }

  getChildren(element?: DclExplorerNode): vscode.ProviderResult<DclExplorerNode[]> {
    if (element) return element.children;
    if (this.state.kind === "empty") {
      return [new DclExplorerNode(this.state.message, [], undefined, "empty")];
    }
    const summary = this.state.summary;

    const roots = [
      group("Contexts", summary.contexts?.map((context) => {
        const dependencies = section("Dependencies", context.dependencies?.map((item) => itemNode(item)));
        return new DclExplorerNode(context.name, dependencies ? [dependencies] : [], context.location, "context");
      }), "dclExplorer.contexts"),
      group("Capabilities", summary.capabilities.map(capabilityNode)),
      group("Actors", semanticItems(summary.actors)),
      group("Policies", semanticItems(summary.policies)),
      group("Effects", semanticItems(summary.effects)),
      group("Events", semanticItems(summary.events, "event"), "dclExplorer.events"),
      group("Lifecycles", semanticItems(summary.lifecycles)),
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
    eventsSection(capability),
    sectionFromCapability("Policies", "policies", capability),
    lifecycleSection(capability),
  ].filter((node): node is DclExplorerNode => Boolean(node));

  const contextValue = `dclExplorer.capability${capability.location ? ".located" : ""}${capability.lifecycle ? ".lifecycle" : ""}${capability.eventDetails?.length ? ".events" : ""}`;
  return new DclExplorerNode(capability.name, children, capability.location, "capability", capability.context, capability.name, undefined, contextValue);
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
  return new DclExplorerNode("Lifecycle", items, undefined, "lifecycle", undefined, capability.name);
}

function eventsSection(capability: CapabilitySummary): DclExplorerNode | undefined {
  const details = capability.eventDetails;
  const children = details?.map((event) => eventNode(event.label, capability.itemLocations?.events?.[event.label] ?? capability.itemLocations?.events?.[event.event], capability.name, event.event));
  if (children?.length) return section("Events", children);
  return sectionFromCapability("Events", "events", capability);
}

function labelItems(items: string[] | undefined, locations: Record<string, SourceLocation> | undefined): DclExplorerNode[] {
  return (items ?? []).map((item) => itemNode(item, locations?.[item]));
}

function semanticItems(items: SemanticItem[] | undefined, kind: "item" | "event" = "item"): DclExplorerNode[] | undefined {
  return items?.map((item) => kind === "event" ? eventNode(item.label, item.location, undefined, item.label) : itemNode(item.label, item.location));
}

function group(label: string, children: DclExplorerNode[] | undefined, contextValue?: string): DclExplorerNode | undefined {
  if (!children?.length) return undefined;
  return new DclExplorerNode(label, children, undefined, "group", undefined, undefined, undefined, contextValue);
}

function section(label: string, children: DclExplorerNode[] | undefined): DclExplorerNode | undefined {
  if (!children?.length) return undefined;
  return new DclExplorerNode(label, children, undefined, "section");
}

function itemNode(label: string, location?: SourceLocation): DclExplorerNode {
  return new DclExplorerNode(label, [], location, "item");
}

function eventNode(label: string, location: SourceLocation | undefined, capabilityName: string | undefined, eventName: string): DclExplorerNode {
  return new DclExplorerNode(label, [], location, "event", capabilityName, capabilityName, eventName);
}

function iconFor(kind: ExplorerNodeKind, label: string): vscode.ThemeIcon | undefined {
  if (kind === "empty") return new vscode.ThemeIcon("info");
  if (kind === "group") return new vscode.ThemeIcon("folder");
  if (kind === "context") return new vscode.ThemeIcon("symbol-namespace");
  if (kind === "capability") return new vscode.ThemeIcon("symbol-class");
  if (kind === "lifecycle") return new vscode.ThemeIcon("git-branch");
  if (kind === "event") return new vscode.ThemeIcon("symbol-event");
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
