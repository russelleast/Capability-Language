import version from "../../../version.json";

export const languageVersion = version.language.version;
export const languageName = version.language.name.toUpperCase();
export const languageLabel = `${languageName} v${languageVersion}`;
export const languageStatus = "Experimental";
export const compilerVersion = version.compiler.version;
