"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayNameForGraph = displayNameForGraph;
exports.graphSourceName = graphSourceName;
function displayNameForGraph(value) {
    const normalized = value
        .trim()
        .replace(/[.]+/g, " / ")
        .replace(/[-_]+/g, " ")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim();
    if (!normalized)
        return value;
    return normalized
        .split(" ")
        .map((part) => part === "/" ? part : titleCasePart(part))
        .join(" ");
}
function graphSourceName(value) {
    return value;
}
function titleCasePart(value) {
    if (!value)
        return value;
    if (value.toUpperCase() === value && /[A-Z]/.test(value))
        return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}
//# sourceMappingURL=DclGraphLabels.js.map