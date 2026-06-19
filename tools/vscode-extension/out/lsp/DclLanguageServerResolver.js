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
exports.resolveDclLanguageServer = resolveDclLanguageServer;
exports.localLanguageServerName = localLanguageServerName;
exports.bundledLanguageServerName = bundledLanguageServerName;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DclCompilerResolver_1 = require("../compiler/DclCompilerResolver");
function resolveDclLanguageServer(options) {
    const platform = options.platform ?? process.platform;
    const arch = options.arch ?? process.arch;
    const existsSync = options.existsSync ?? fs.existsSync;
    const configured = (options.configuredLanguageServerPath ?? "").trim();
    const localName = localLanguageServerName(platform);
    const localPath = options.extensionPath ? path.join(options.extensionPath, "bin", localName) : undefined;
    const localAvailable = Boolean(localPath && existsSync(localPath));
    const bundledName = bundledLanguageServerName(platform, arch);
    const bundledPath = bundledName && options.extensionPath ? path.join(options.extensionPath, "bin", bundledName) : undefined;
    const bundledAvailable = Boolean(bundledPath && existsSync(bundledPath));
    const workspaceRoot = options.workspaceFolders?.[0];
    if (configured) {
        const [command, ...args] = (0, DclCompilerResolver_1.splitCommand)(configured);
        return {
            command: command || configured,
            args,
            cwd: workspaceRoot,
            source: "configured",
            platform,
            arch,
            bundledPath,
            bundledAvailable,
            localPath,
            localAvailable,
            supportedBundleName: bundledName,
        };
    }
    if (localPath && localAvailable) {
        return {
            command: localPath,
            args: [],
            cwd: workspaceRoot,
            source: "local",
            platform,
            arch,
            bundledPath,
            bundledAvailable,
            localPath,
            localAvailable,
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
            localPath,
            localAvailable,
            supportedBundleName: bundledName,
        };
    }
    return {
        command: "dcl-lsp",
        args: [],
        cwd: workspaceRoot,
        source: "path",
        platform,
        arch,
        bundledPath,
        bundledAvailable,
        localPath,
        localAvailable,
        supportedBundleName: bundledName,
    };
}
function localLanguageServerName(platform) {
    return platform === "win32" ? "dcl-lsp.exe" : "dcl-lsp";
}
function bundledLanguageServerName(platform, arch) {
    if (platform === "darwin" && arch === "arm64")
        return "dcl-lsp-darwin-arm64";
    if (platform === "darwin" && arch === "x64")
        return "dcl-lsp-darwin-x64";
    if (platform === "linux" && arch === "x64")
        return "dcl-lsp-linux-x64";
    if (platform === "win32" && arch === "x64")
        return "dcl-lsp-win32-x64.exe";
    return undefined;
}
//# sourceMappingURL=DclLanguageServerResolver.js.map