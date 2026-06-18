"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildContextMapGraph = buildContextMapGraph;
function buildContextMapGraph(summary, selectedContext) {
    if (!summary.contexts?.length)
        return undefined;
    const contexts = selectedContext
        ? relatedContexts(summary.contexts, selectedContext)
        : summary.contexts;
    if (!contexts.length)
        return undefined;
    const known = new Set(summary.contexts.map((context) => context.name));
    const included = new Set(contexts.map((context) => context.name));
    const nodes = [];
    const edges = [];
    for (const context of contexts) {
        nodes.push(contextNode(context, Boolean(context.parent)));
        if (context.parent && included.has(context.parent)) {
            edges.push(edge(context.parent, context.name, "contains", "contains"));
        }
        for (const child of context.children ?? []) {
            if (included.has(child)) {
                edges.push(edge(context.name, child, "contains", "contains"));
            }
        }
        for (const dependency of context.dependencies ?? []) {
            if (!known.has(dependency)) {
                nodes.push({
                    id: contextId(dependency),
                    label: dependency,
                    kind: "external-context",
                });
            }
            edges.push(edge(context.name, dependency, "depends on", "depends-on"));
        }
    }
    return {
        title: selectedContext ? `${selectedContext} Context Map` : "DCL Context Map",
        nodes: dedupeNodes(nodes),
        edges: dedupeEdges(edges),
    };
}
function relatedContexts(contexts, selected) {
    const byName = new Map(contexts.map((context) => [context.name, context]));
    const names = new Set([selected]);
    const context = byName.get(selected);
    if (!context)
        return [];
    if (context.parent)
        names.add(context.parent);
    for (const child of context.children ?? [])
        names.add(child);
    for (const dependency of context.dependencies ?? [])
        names.add(dependency);
    for (const candidate of contexts) {
        if (candidate.parent === selected)
            names.add(candidate.name);
        if (candidate.dependencies?.includes(selected))
            names.add(candidate.name);
    }
    return Array.from(names).map((name) => byName.get(name)).filter((item) => Boolean(item));
}
function contextNode(context, isChild) {
    return {
        id: contextId(context.name),
        label: context.name,
        kind: isChild ? "child-context" : "context",
        source: context.location,
    };
}
function edge(source, target, label, kind) {
    return {
        id: `${contextId(source)}->${contextId(target)}:${kind}`,
        source: contextId(source),
        target: contextId(target),
        label,
        kind,
    };
}
function contextId(name) {
    return `context:${slug(name)}`;
}
function slug(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
function dedupeNodes(nodes) {
    return Array.from(new Map(nodes.map((node) => [node.id, node])).values());
}
function dedupeEdges(edges) {
    return Array.from(new Map(edges.map((edge) => [edge.id, edge])).values());
}
//# sourceMappingURL=DclContextMapGraphBuilder.js.map