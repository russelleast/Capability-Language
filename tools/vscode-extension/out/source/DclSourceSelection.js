"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.semanticIdentityAtSourcePosition = semanticIdentityAtSourcePosition;
const DclSemanticIdentity_1 = require("../graphs/DclSemanticIdentity");
const DclSourceLocation_1 = require("./DclSourceLocation");
function semanticIdentityAtSourcePosition(summary, documentUri, position) {
    if (!summary)
        return undefined;
    const candidates = candidatesWithDerivedRanges(sourceCandidates(summary), documentUri);
    const matches = candidates.filter((candidate) => containsPosition(candidate, documentUri, position));
    matches.sort((left, right) => {
        if (right.specificity !== left.specificity)
            return right.specificity - left.specificity;
        return rangeSize(left) - rangeSize(right);
    });
    return matches[0]?.identity;
}
function sourceCandidates(summary) {
    const candidates = [];
    for (const context of summary.contexts ?? []) {
        addCandidate(candidates, "context", context.name, context.location, 10, true);
    }
    for (const item of summary.events ?? [])
        addCandidate(candidates, "event", item.label, item.location, 30, false);
    for (const item of summary.effects ?? [])
        addCandidate(candidates, "effect", item.label, item.location, 30, false);
    for (const item of summary.policies ?? [])
        addCandidate(candidates, "policy", item.label, item.location, 30, false);
    for (const capability of summary.capabilities) {
        addCandidate(candidates, "capability", capability.name, capability.location, 20, true);
        addCapabilityItemCandidates(candidates, capability);
    }
    return candidates;
}
function addCapabilityItemCandidates(candidates, capability) {
    addItems(candidates, "event", capability, "events", eventNameFromLabel);
    addItems(candidates, "effect", capability, "effects", effectNameFromLabel);
    addItems(candidates, "policy", capability, "policies", policyNameFromLabel);
    for (const [label, location] of Object.entries(capability.itemLocations?.lifecycle ?? {})) {
        addCandidate(candidates, lifecycleIdentityKind(label), lifecycleIdentityName(label), location, 40, false);
    }
}
function addItems(candidates, identityKind, capability, itemKind, identityName) {
    for (const [label, location] of Object.entries(capability.itemLocations?.[itemKind] ?? {})) {
        addCandidate(candidates, identityKind, identityName(label), location, 40, false);
    }
}
function addCandidate(candidates, kind, name, source, specificity, container) {
    const identity = (0, DclSemanticIdentity_1.semanticIdentity)(kind, name);
    const normalized = (0, DclSourceLocation_1.normalizeSourceLocation)(source, "oneBased");
    if (!identity || !normalized.ok)
        return;
    candidates.push({
        identity,
        location: normalized.location,
        end: normalizedEnd(source),
        specificity,
        container,
    });
}
function candidatesWithDerivedRanges(candidates, documentUri) {
    const containers = candidates
        .filter((candidate) => candidate.container && sameFile(candidate.location.file, documentUri.fsPath))
        .sort(compareLocation);
    return candidates.map((candidate) => {
        if (candidate.end || !candidate.container || !sameFile(candidate.location.file, documentUri.fsPath))
            return candidate;
        const next = containers.find((item) => compareLocation(item, candidate) > 0);
        return next
            ? { ...candidate, end: { line: next.location.line, column: next.location.column } }
            : { ...candidate, end: { line: Number.MAX_SAFE_INTEGER, column: Number.MAX_SAFE_INTEGER } };
    });
}
function normalizedEnd(source) {
    if (!Number.isInteger(source?.endLine))
        return undefined;
    const normalized = (0, DclSourceLocation_1.normalizeSourceLocation)({
        file: source?.file,
        line: source?.endLine,
        column: source?.endColumn,
        indexBase: source?.indexBase,
    }, "oneBased");
    return normalized.ok ? { line: normalized.location.line, column: normalized.location.column } : undefined;
}
function containsPosition(candidate, documentUri, position) {
    if (!sameFile(candidate.location.file, documentUri.fsPath))
        return false;
    const end = candidate.end ?? { line: candidate.location.line, column: Number.MAX_SAFE_INTEGER };
    return comparePosition(position, candidate.location) >= 0 && comparePosition(position, end) < 0;
}
function sameFile(left, right) {
    const normalizedLeft = normalizePath(left);
    const normalizedRight = normalizePath(right);
    return normalizedLeft === normalizedRight || normalizedRight.endsWith(`/${normalizedLeft}`);
}
function normalizePath(value) {
    return value.replace(/\\/g, "/").replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");
}
function compareLocation(left, right) {
    return left.location.line - right.location.line || left.location.column - right.location.column;
}
function comparePosition(left, right) {
    return left.line - right.line || left.character - right.column;
}
function rangeSize(candidate) {
    const end = candidate.end ?? { line: candidate.location.line, column: Number.MAX_SAFE_INTEGER };
    return (end.line - candidate.location.line) * 100000 + (end.column - candidate.location.column);
}
function eventNameFromLabel(label) {
    return label.replace(/\s+from\s+.+$/i, "");
}
function effectNameFromLabel(label) {
    return label.replace(/\s+after\s+.+$/i, "");
}
function policyNameFromLabel(label) {
    return label.replace(/\s+applies to\s+.+$/i, "");
}
function lifecycleIdentityKind(label) {
    if (label.includes("->"))
        return "lifecycle-transition";
    if (/^begin\s+/i.test(label) || /^end\s+/i.test(label))
        return "lifecycle-step";
    return "lifecycle";
}
function lifecycleIdentityName(label) {
    return label.replace(/^begin\s+/i, "").replace(/^end\s+/i, "");
}
//# sourceMappingURL=DclSourceSelection.js.map