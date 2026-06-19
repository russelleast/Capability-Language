"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.semanticIdentity = semanticIdentity;
exports.semanticIdentityEquals = semanticIdentityEquals;
exports.findGraphNodeBySemanticIdentity = findGraphNodeBySemanticIdentity;
function semanticIdentity(kind, name) {
    const normalizedName = name?.trim();
    return normalizedName ? { kind, name: normalizedName } : undefined;
}
function semanticIdentityEquals(left, right) {
    return Boolean(left && right && left.kind === right.kind && left.name === right.name);
}
function findGraphNodeBySemanticIdentity(graph, identity) {
    if (!graph || !identity)
        return undefined;
    return graph.nodes.find((node) => semanticIdentityEquals(node.semanticIdentity, identity));
}
//# sourceMappingURL=DclSemanticIdentity.js.map