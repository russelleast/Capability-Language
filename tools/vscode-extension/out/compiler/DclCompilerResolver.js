"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDclCompiler = resolveDclCompiler;
exports.getDclCompilerInfo = getDclCompilerInfo;
exports.bundledCompilerName = bundledCompilerName;
exports.splitCommand = splitCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function resolveDclCompiler(options) {
    const info = getDclCompilerInfo(options);
    return {
        command: info.command,
        args: info.args,
        cwd: info.cwd,
        source: info.source,
        platform: info.platform,
        arch: info.arch,
        bundledPath: info.bundledPath,
        bundledAvailable: info.bundledAvailable,
        supportedBundleName: info.supportedBundleName,
    };
}
function getDclCompilerInfo(options) {
    const platform = options.platform ?? process.platform;
    const arch = options.arch ?? process.arch;
    const existsSync = options.existsSync ?? fs.existsSync;
    const configured = (options.configuredCompilerPath ?? "").trim();
    const bundledName = bundledCompilerName(platform, arch);
    const bundledPath = bundledName && options.extensionPath ? path.join(options.extensionPath, "bin", bundledName) : undefined;
    const bundledAvailable = Boolean(bundledPath && existsSync(bundledPath));
    const workspaceRoot = options.workspaceFolders?.[0];
    if (configured) {
        const [command, ...args] = splitCommand(configured);
        return {
            command: command || configured,
            args,
            cwd: workspaceRoot,
            source: "configured",
            platform,
            arch,
            bundledPath,
            bundledAvailable,
            supportedBundleName: bundledName,
        };
    }
    if (bundledPath && bundledAvailable) {
        return {
            command: bundledPath,
            args: [],
            cwd: workspaceRoot,
            source: "bundled",
            platform,
            arch,
            bundledPath,
            bundledAvailable,
            supportedBundleName: bundledName,
        };
    }
    return {
        command: "dcl",
        args: [],
        cwd: workspaceRoot,
        source: "path",
        platform,
        arch,
        bundledPath,
        bundledAvailable,
        supportedBundleName: bundledName,
    };
}
function bundledCompilerName(platform, arch) {
    if (platform === "darwin" && arch === "arm64")
        return "dcl-darwin-arm64";
    if (platform === "darwin" && arch === "x64")
        return "dcl-darwin-x64";
    if (platform === "linux" && arch === "x64")
        return "dcl-linux-x64";
    if (platform === "win32" && arch === "x64")
        return "dcl-win32-x64.exe";
    return undefined;
}
function splitCommand(commandLine) {
    const parts = commandLine.match(/"[^"]+"|'[^']+'|\S+/g) ?? [];
    return parts.map((part) => part.replace(/^["']|["']$/g, ""));
}
//# sourceMappingURL=DclCompilerResolver.js.map