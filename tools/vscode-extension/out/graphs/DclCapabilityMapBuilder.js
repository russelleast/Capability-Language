"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAPABILITY_MAP_DESCRIPTION = void 0;
exports.buildCapabilityMap = buildCapabilityMap;
exports.capabilityMapItems = capabilityMapItems;
exports.findCapabilityMapItemBySemanticIdentity = findCapabilityMapItemBySemanticIdentity;
const DclSemanticIdentity_1 = require("./DclSemanticIdentity");
exports.CAPABILITY_MAP_DESCRIPTION = "The Capability Map shows declared capabilities grouped by DCL context. It is a responsibility map, not a dependency, runtime, service, or infrastructure diagram.";
const SYNTHETIC_ROOT_CONTEXT = "__capability_map_root__";
function buildCapabilityMap(summary) {
    if (!summary.capabilities.length)
        return undefined;
    const warnings = [];
    const declaredContexts = declaredContextSummaries(summary.contexts);
    const contextByName = new Map(declaredContexts.map((context) => [context.name, context]));
    const parentByChild = parentByChildContext(declaredContexts);
    const root = contextContainer(SYNTHETIC_ROOT_CONTEXT, undefined, true);
    const containerByName = new Map();
    for (const context of declaredContexts) {
        containerByName.set(context.name, contextContainer(context.name, context.location));
    }
    for (const context of declaredContexts) {
        const container = containerByName.get(context.name);
        if (!container)
            continue;
        const parentName = context.parent ?? parentByChild.get(context.name);
        const parent = parentName ? containerByName.get(parentName) : root;
        if (parent) {
            parent.children.push(container);
        }
        else {
            warnings.push(`Context '${context.name}' references missing parent context '${parentName}', so it is shown in an unlabelled top-level map area.`);
            root.children.push(container);
        }
    }
    const childNames = new Set([
        ...declaredContexts.filter((context) => context.parent).map((context) => context.name),
        ...parentByChild.keys(),
    ]);
    for (const context of declaredContexts) {
        if (!context.parent && !childNames.has(context.name) && !root.children.some((child) => child.name === context.name)) {
            root.children.push(containerByName.get(context.name));
        }
    }
    for (const capability of summary.capabilities) {
        const diagnostics = diagnosticsForCapability(summary.diagnostics, capability);
        const tile = capabilityTile(capability, diagnostics);
        const ownerName = capability.context;
        const owner = ownerName ? containerByName.get(ownerName) : undefined;
        if (owner) {
            owner.capabilities.push(tile);
        }
        else {
            if (ownerName && !contextByName.has(ownerName)) {
                warnings.push(`Capability '${capability.name}' references context '${ownerName}', but that declared context was not available, so it is shown in an unlabelled fallback area.`);
            }
            root.capabilities.push(tile);
        }
    }
    sortContext(root);
    return {
        title: "DCL Capability Map",
        description: exports.CAPABILITY_MAP_DESCRIPTION,
        root,
        warnings: dedupe(warnings),
    };
}
function capabilityMapItems(map) {
    if (!map)
        return [];
    const items = [];
    visitContext(map.root, (context) => {
        items.push(context);
        items.push(...context.capabilities);
    });
    return items;
}
function findCapabilityMapItemBySemanticIdentity(map, identity) {
    if (!identity)
        return undefined;
    return capabilityMapItems(map).find((item) => (item.semanticIdentity.kind === identity.kind
        && item.semanticIdentity.name === identity.name));
}
function declaredContextSummaries(contexts) {
    return (contexts ?? []).filter((context) => context.name !== "Workspace");
}
function parentByChildContext(contexts) {
    const parents = new Map();
    for (const context of contexts) {
        for (const child of context.children ?? []) {
            if (!parents.has(child))
                parents.set(child, context.name);
        }
    }
    return parents;
}
function contextContainer(name, source, synthetic = false) {
    return {
        id: synthetic ? "context:root" : `context:${slug(name)}`,
        name: synthetic ? "" : name,
        kind: "context",
        synthetic,
        source,
        semanticIdentity: (0, DclSemanticIdentity_1.semanticIdentity)("context", synthetic ? "root" : name),
        capabilities: [],
        children: [],
    };
}
function capabilityTile(capability, diagnostics) {
    return {
        id: `capability:${slug(capability.name)}`,
        name: capability.name,
        context: capability.context,
        kind: "capability",
        source: capability.location,
        semanticIdentity: (0, DclSemanticIdentity_1.semanticIdentity)("capability", capability.name),
        badges: [],
        diagnostics,
    };
}
function diagnosticsForCapability(diagnostics, capability) {
    const matched = (diagnostics ?? []).filter((diagnostic) => {
        if (diagnostic.severity !== "warning")
            return false;
        if (diagnostic.node === capability.name || diagnostic.node === capability.id)
            return true;
        if (!diagnostic.location || !capability.location)
            return false;
        return diagnostic.location.file === capability.location.file
            && diagnostic.location.line === capability.location.line
            && diagnostic.location.column === capability.location.column;
    });
    return matched.length ? matched : undefined;
}
function visitContext(context, visitor) {
    visitor(context);
    for (const child of context.children)
        visitContext(child, visitor);
}
function sortContext(context) {
    context.capabilities.sort((a, b) => a.name.localeCompare(b.name));
    context.children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of context.children)
        sortContext(child);
}
function dedupe(items) {
    const values = Array.from(new Set(items));
    return values.length ? values : undefined;
}
function slug(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}
//# sourceMappingURL=DclCapabilityMapBuilder.js.map