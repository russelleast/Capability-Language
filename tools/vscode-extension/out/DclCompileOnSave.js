"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DclCompileOnSaveScheduler = void 0;
exports.resolveCompileOnSaveMode = resolveCompileOnSaveMode;
const DEFAULT_DEBOUNCE_MS = 500;
function resolveCompileOnSaveMode(configuration) {
    const explicitMode = explicitConfigurationValue(configuration, "compileOnSaveMode");
    if (isCompileOnSaveMode(explicitMode)) {
        return explicitMode;
    }
    const legacyCompileOnSave = configuration.get("compileOnSave", true);
    return legacyCompileOnSave ? "workspace" : "off";
}
class DclCompileOnSaveScheduler {
    constructor(options) {
        this.delayMs = options.delayMs ?? DEFAULT_DEBOUNCE_MS;
        this.compileWorkspace = options.compileWorkspace;
        this.compileFile = options.compileFile;
        this.setTimer = options.setTimer ?? setTimeout;
        this.clearTimer = options.clearTimer ?? clearTimeout;
    }
    handleSavedDocument(document, mode) {
        if (document.languageId !== "dcl" || document.uri.scheme !== "file" || mode === "off") {
            return;
        }
        if (mode === "file") {
            void this.compileFile(document.uri);
            return;
        }
        this.scheduleWorkspaceCompile();
    }
    dispose() {
        if (this.pendingWorkspaceCompile) {
            this.clearTimer(this.pendingWorkspaceCompile);
            this.pendingWorkspaceCompile = undefined;
        }
    }
    scheduleWorkspaceCompile() {
        if (this.pendingWorkspaceCompile) {
            this.clearTimer(this.pendingWorkspaceCompile);
        }
        this.pendingWorkspaceCompile = this.setTimer(() => {
            this.pendingWorkspaceCompile = undefined;
            void this.compileWorkspace();
        }, this.delayMs);
    }
}
exports.DclCompileOnSaveScheduler = DclCompileOnSaveScheduler;
function explicitConfigurationValue(configuration, key) {
    const inspected = configuration.inspect?.(key);
    if (!inspected)
        return undefined;
    return inspected.workspaceFolderLanguageValue
        ?? inspected.workspaceFolderValue
        ?? inspected.workspaceLanguageValue
        ?? inspected.workspaceValue
        ?? inspected.globalLanguageValue
        ?? inspected.globalValue;
}
function isCompileOnSaveMode(value) {
    return value === "workspace" || value === "file" || value === "off";
}
//# sourceMappingURL=DclCompileOnSave.js.map