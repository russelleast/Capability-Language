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
