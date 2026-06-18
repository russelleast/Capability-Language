import version from "../../../version.json";
import extensionPackage from "../../../tools/vscode-extension/package.json";

export const languageVersion = version.language.version;
export const languageName = version.language.name.toUpperCase();
export const languageLabel = `${languageName} v${languageVersion}`;
export const languageStatus = "Experimental";
export const compilerVersion = version.compiler.version;
export const vscodeExtensionVersion = extensionPackage.version;
export const vscodeExtensionVsixName = `dcl-vscode-extension-v${vscodeExtensionVersion}.vsix`;
export const vscodeExtensionReleaseUrl = `https://github.com/russelleast/Capability-Language/releases/latest/download/${vscodeExtensionVsixName}`;
