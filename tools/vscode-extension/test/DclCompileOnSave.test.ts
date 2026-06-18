import { afterEach, describe, expect, it, vi } from "vitest";
import { DclCompileOnSaveScheduler, resolveCompileOnSaveMode } from "../src/DclCompileOnSave";
import * as vscode from "vscode";

type ConfigValues = {
  mode?: unknown;
  legacy?: boolean;
};

describe("compile-on-save mode", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses workspace mode when compileOnSaveMode is explicitly workspace", () => {
    expect(resolveCompileOnSaveMode(configuration({ mode: "workspace", legacy: false }))).toBe("workspace");
  });

  it("uses file mode when compileOnSaveMode is explicitly file", () => {
    expect(resolveCompileOnSaveMode(configuration({ mode: "file", legacy: true }))).toBe("file");
  });

  it("uses off mode when compileOnSaveMode is explicitly off", () => {
    expect(resolveCompileOnSaveMode(configuration({ mode: "off", legacy: true }))).toBe("off");
  });

  it("maps legacy compileOnSave true to workspace when the new mode is not explicit", () => {
    expect(resolveCompileOnSaveMode(configuration({ legacy: true }))).toBe("workspace");
  });

  it("maps legacy compileOnSave false to off when the new mode is not explicit", () => {
    expect(resolveCompileOnSaveMode(configuration({ legacy: false }))).toBe("off");
  });

  it("debounces workspace compile on rapid DCL saves", () => {
    vi.useFakeTimers();
    const compileWorkspace = vi.fn();
    const compileFile = vi.fn();
    const scheduler = new DclCompileOnSaveScheduler({
      delayMs: 500,
      compileWorkspace,
      compileFile,
    });

    scheduler.handleSavedDocument(dclDocument("one.dcl"), "workspace");
    scheduler.handleSavedDocument(dclDocument("two.dcl"), "workspace");
    scheduler.handleSavedDocument(dclDocument("three.dcl"), "workspace");

    vi.advanceTimersByTime(499);
    expect(compileWorkspace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(compileWorkspace).toHaveBeenCalledTimes(1);
    expect(compileFile).not.toHaveBeenCalled();
  });

  it("compiles only the saved file in file mode", () => {
    const compileWorkspace = vi.fn();
    const compileFile = vi.fn();
    const scheduler = new DclCompileOnSaveScheduler({
      compileWorkspace,
      compileFile,
    });
    const document = dclDocument("current.dcl");

    scheduler.handleSavedDocument(document, "file");

    expect(compileFile).toHaveBeenCalledWith(document.uri);
    expect(compileWorkspace).not.toHaveBeenCalled();
  });

  it("does nothing in off mode", () => {
    const compileWorkspace = vi.fn();
    const compileFile = vi.fn();
    const scheduler = new DclCompileOnSaveScheduler({
      compileWorkspace,
      compileFile,
    });

    scheduler.handleSavedDocument(dclDocument("current.dcl"), "off");

    expect(compileFile).not.toHaveBeenCalled();
    expect(compileWorkspace).not.toHaveBeenCalled();
  });

  it("ignores non-DCL documents", () => {
    const compileWorkspace = vi.fn();
    const compileFile = vi.fn();
    const scheduler = new DclCompileOnSaveScheduler({
      compileWorkspace,
      compileFile,
    });

    scheduler.handleSavedDocument({ languageId: "typescript", uri: vscode.Uri.file("current.ts") }, "workspace");

    expect(compileFile).not.toHaveBeenCalled();
    expect(compileWorkspace).not.toHaveBeenCalled();
  });
});

function configuration(values: ConfigValues) {
  return {
    get<T>(key: string, defaultValue: T): T {
      if (key === "compileOnSave" && values.legacy !== undefined) {
        return values.legacy as T;
      }
      return defaultValue;
    },
    inspect<T>(key: string): { globalValue?: T } | undefined {
      if (key === "compileOnSaveMode" && values.mode !== undefined) {
        return { globalValue: values.mode as T };
      }
      return undefined;
    },
  };
}

function dclDocument(name: string) {
  const uri = vscode.Uri.file(name) as vscode.Uri & { scheme: string };
  uri.scheme = "file";
  return {
    languageId: "dcl",
    uri,
  };
}
