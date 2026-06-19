"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_CONTEXTS = exports.ALL_EVENT_FLOWS = void 0;
exports.buildGraphWorkspaceState = buildGraphWorkspaceState;
const DclArchitectureOverviewGraphBuilder_1 = require("./DclArchitectureOverviewGraphBuilder");
const DclCapabilityGraphBuilder_1 = require("./DclCapabilityGraphBuilder");
const DclContextMapGraphBuilder_1 = require("./DclContextMapGraphBuilder");
const DclEventFlowGraphBuilder_1 = require("./DclEventFlowGraphBuilder");
const DclGraphExport_1 = require("./DclGraphExport");
const DclLifecycleGraphBuilder_1 = require("./DclLifecycleGraphBuilder");
const DclSemanticIdentity_1 = require("./DclSemanticIdentity");
const semanticSummary_1 = require("../views/semanticSummary");
exports.ALL_EVENT_FLOWS = "__all_event_flows__";
exports.ALL_CONTEXTS = "__all_contexts__";
function buildGraphWorkspaceState(summary, selection = {}) {
    const graphType = selection.graphType ?? "architecture";
    const architectureDetailLevel = selection.architectureDetailLevel ?? "overview";
    const subjects = subjectOptions(summary, graphType);
    const subject = selectedSubject(selection.subject, subjects, graphType);
    const graph = buildSelectedGraph(summary, graphType, subject, architectureDetailLevel);
    const empty = graph ? undefined : emptyState(summary, graphType, subject);
    return {
        graphType,
        graphTypes: graphTypeOptions(),
        subject,
        subjects,
        architectureDetailLevel,
        graph,
        focusNodeId: (0, DclSemanticIdentity_1.findGraphNodeBySemanticIdentity)(graph, selection.focusIdentity)?.id,
        exportBaseName: (0, DclGraphExport_1.graphExportBaseName)(graphType, subject),
        emptyTitle: empty?.title,
        emptyMessage: empty?.message,
    };
}
function buildSelectedGraph(summary, graphType, subject, architectureDetailLevel) {
    switch (graphType) {
        case "architecture":
            return summary.contexts?.length || summary.capabilities.length
                ? (0, DclArchitectureOverviewGraphBuilder_1.buildArchitectureOverviewGraph)(summary, architectureDetailLevel)
                : undefined;
        case "capability":
            return subject ? (0, DclCapabilityGraphBuilder_1.buildCapabilityGraph)(summary, subject) : undefined;
        case "lifecycle":
            return subject ? (0, DclLifecycleGraphBuilder_1.buildLifecycleGraph)(summary, subject) : undefined;
        case "event-flow":
            return (0, DclEventFlowGraphBuilder_1.buildEventFlowGraph)(summary, subject === exports.ALL_EVENT_FLOWS ? undefined : subject);
        case "context-map":
            return (0, DclContextMapGraphBuilder_1.buildContextMapGraph)(summary, subject === exports.ALL_CONTEXTS ? undefined : subject);
    }
}
function selectedSubject(requested, subjects, graphType) {
    if (graphType === "architecture")
        return undefined;
    if (requested && subjects.some((subject) => subject.value === requested))
        return requested;
    return subjects[0]?.value;
}
function subjectOptions(summary, graphType) {
    switch (graphType) {
        case "architecture":
            return [];
        case "capability":
            return summary.capabilities.map((capability) => ({
                label: capability.name,
                value: capability.name,
                description: capability.context,
            }));
        case "lifecycle":
            return summary.capabilities
                .filter((capability) => capability.lifecycle)
                .map((capability) => ({
                label: capability.name,
                value: capability.name,
                description: capability.context,
            }));
        case "event-flow":
            return eventNames(summary).length
                ? [
                    { label: "All event flows", value: exports.ALL_EVENT_FLOWS },
                    ...eventNames(summary).map((event) => ({ label: event, value: event })),
                ]
                : [];
        case "context-map":
            return displayContexts(summary).length
                ? [
                    { label: "All contexts", value: exports.ALL_CONTEXTS },
                    ...displayContexts(summary).map((context) => ({
                        label: context.name,
                        value: context.name,
                        description: context.parent ? `child of ${context.parent}` : undefined,
                    })),
                ]
                : [];
    }
}
function displayContexts(summary) {
    return (0, semanticSummary_1.normalizeContextsForDisplay)(summary.contexts, summary.capabilities) ?? [];
}
function eventNames(summary) {
    const names = new Set();
    for (const event of summary.events ?? [])
        names.add(event.label);
    for (const capability of summary.capabilities) {
        for (const event of capability.eventDetails ?? [])
            names.add(event.event);
        for (const transition of capability.lifecycle?.transitionDetails ?? []) {
            if (transition.triggerKind === "event" && transition.triggerName)
                names.add(transition.triggerName);
        }
    }
    return Array.from(names).sort();
}
function emptyState(summary, graphType, subject) {
    switch (graphType) {
        case "architecture":
            return {
                title: "No Architecture Items",
                message: "The compiled semantic summary does not include contexts or capabilities.",
            };
        case "capability":
            return {
                title: "No Capability Available",
                message: summary.capabilities.length
                    ? `No compiler summary found for capability '${subject ?? ""}'.`
                    : "The compiled semantic summary does not include capabilities.",
            };
        case "lifecycle":
            return {
                title: "No Lifecycle Available",
                message: summary.capabilities.some((capability) => capability.lifecycle)
                    ? `No lifecycle graph is available for '${subject ?? ""}'.`
                    : "The compiled semantic summary does not include lifecycle data.",
            };
        case "event-flow":
            return {
                title: "No Events Declared",
                message: "The compiled semantic summary does not include declared or referenced events.",
            };
        case "context-map":
            return {
                title: "No Contexts Declared",
                message: "The compiled semantic summary does not include declared contexts.",
            };
    }
}
function graphTypeOptions() {
    return [
        { label: "Architecture Overview", value: "architecture" },
        { label: "Capability Graph", value: "capability" },
        { label: "Lifecycle Graph", value: "lifecycle" },
        { label: "Event Flow Graph", value: "event-flow" },
        { label: "Context Map", value: "context-map" },
    ];
}
//# sourceMappingURL=DclGraphWorkspaceState.js.map