"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphExportBaseName = graphExportBaseName;
exports.graphExportFilename = graphExportFilename;
const DclGraphWorkspaceState_1 = require("./DclGraphWorkspaceState");
function graphExportBaseName(graphType, subject) {
    switch (graphType) {
        case "architecture":
            return "dcl-architecture-overview";
        case "capability":
            return `dcl-capability-${kebabSubject(subject)}`;
        case "lifecycle":
            return `dcl-lifecycle-${kebabSubject(subject)}`;
        case "event-flow":
            return `dcl-event-flow-${kebabSubject(subject === DclGraphWorkspaceState_1.ALL_EVENT_FLOWS ? "all-events" : subject)}`;
        case "context-map":
            return `dcl-context-map-${kebabSubject(subject === DclGraphWorkspaceState_1.ALL_CONTEXTS ? "all-contexts" : subject)}`;
    }
}
function graphExportFilename(graphType, subject, format) {
    return `${graphExportBaseName(graphType, subject)}.${format}`;
}
function kebabSubject(subject) {
    return (subject ?? "graph")
        .trim()
        .replace(/[.]+/g, " ")
        .replace(/[-_]+/g, " ")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "graph";
}
//# sourceMappingURL=DclGraphExport.js.map