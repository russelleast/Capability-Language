import version from "../../../version.json";

export const languageVersion = version.language.version;
export const languageName = version.language.name.toUpperCase();
export const languageLabel = `${languageName} v${languageVersion}`;
export const languageStatus = "Stable language core";
export const compilerVersion = version.compiler.version;
export const vscodeExtensionVersion = version.vscode.version;
export const vscodeExtensionVsixName = `dcl-vscode-extension-v${vscodeExtensionVersion}.vsix`;
export const vscodeExtensionReleaseUrl = `https://github.com/russelleast/Capability-Language/releases/latest/download/${vscodeExtensionVsixName}`;
export const vscodeExtensionMarketplaceUrl = "https://marketplace.visualstudio.com/items?itemName=dcl.dcl-vscode-extension";
export const vscodeExtensionSourceUrl = "https://github.com/russelleast/Capability-Language/tree/main/tools/vscode-extension";
export const mcpReleasePageUrl = "https://github.com/russelleast/Capability-Language/releases/latest";
export const mcpDarwinArm64Url = "https://github.com/russelleast/Capability-Language/releases/latest/download/dcl-mcp-darwin-arm64.tar.gz";
export const mcpDarwinAmd64Url = "https://github.com/russelleast/Capability-Language/releases/latest/download/dcl-mcp-darwin-amd64.tar.gz";
export const mcpLinuxAmd64Url = "https://github.com/russelleast/Capability-Language/releases/latest/download/dcl-mcp-linux-amd64.tar.gz";
export const mcpWindowsAmd64Url = "https://github.com/russelleast/Capability-Language/releases/latest/download/dcl-mcp-windows-amd64.zip";
