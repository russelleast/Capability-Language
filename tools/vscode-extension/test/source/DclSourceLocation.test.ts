import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { Uri, window, workspace } from "vscode";
import { normalizeSourceLocation, revealSourceLocation } from "../../src/source/DclSourceLocation";

describe("DclSourceLocation", () => {
  beforeEach(() => {
    workspace.workspaceFolders = [];
    workspace.files = [];
    window.lastShownDocument = undefined;
  });

  it("normalizes valid one-based locations to zero-based editor positions", () => {
    expect(normalizeSourceLocation({ file: "a.dcl", line: 2, column: 3 })).toEqual({
      ok: true,
      location: { file: "a.dcl", line: 1, column: 2 },
    });
  });

  it("rejects missing files", () => {
    expect(normalizeSourceLocation({ line: 1, column: 1 }).ok).toBe(false);
  });

  it("rejects missing lines but defaults missing columns to one", () => {
    expect(normalizeSourceLocation({ file: "a.dcl" }).ok).toBe(false);
    expect(normalizeSourceLocation({ file: "a.dcl", line: 1 })).toEqual({
      ok: true,
      location: { file: "a.dcl", line: 0, column: 0 },
    });
  });

  it("detects out-of-range lines and columns during reveal", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dcl-source-"));
    const file = path.join(dir, "a.dcl");
    fs.writeFileSync(file, "abc\n");

    expect(await revealSourceLocation({ file, line: 99, column: 1 })).toMatchObject({ ok: false });
    expect(await revealSourceLocation({ file, line: 1, column: 99 })).toMatchObject({ ok: false });
  });

  it("resolves relative paths through workspace folders", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dcl-source-"));
    const file = path.join(dir, "relative.dcl");
    fs.writeFileSync(file, "abc\n");
    workspace.workspaceFolders = [{ uri: Uri.file(dir) }];

    expect(await revealSourceLocation({ file: "relative.dcl", line: 1, column: 1 })).toEqual({ ok: true });
  });

  it("resolves a unique basename search result", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dcl-source-"));
    const nested = path.join(dir, "nested");
    fs.mkdirSync(nested);
    const file = path.join(nested, "unique.dcl");
    fs.writeFileSync(file, "abc\n");
    workspace.files = [Uri.file(file)];

    expect(await revealSourceLocation({ file: "unique.dcl", line: 1, column: 1 })).toEqual({ ok: true });
  });

  it("does not guess when basename source paths are ambiguous", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dcl-source-"));
    const first = path.join(dir, "a", "shared.dcl");
    const second = path.join(dir, "b", "shared.dcl");
    fs.mkdirSync(path.dirname(first), { recursive: true });
    fs.mkdirSync(path.dirname(second), { recursive: true });
    fs.writeFileSync(first, "first\n");
    fs.writeFileSync(second, "second\n");
    workspace.files = [Uri.file(first), Uri.file(second)];

    const result = await revealSourceLocation({ file: "shared.dcl", line: 1, column: 1 });

    expect(result).toMatchObject({ ok: false });
    expect(window.lastShownDocument).toBeUndefined();
  });

  it("does not search by basename for missing absolute paths", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dcl-source-"));
    const real = path.join(dir, "missing.dcl");
    fs.writeFileSync(real, "abc\n");
    workspace.files = [Uri.file(real)];

    const result = await revealSourceLocation({ file: path.join(dir, "elsewhere", "missing.dcl"), line: 1, column: 1 });

    expect(result).toMatchObject({ ok: false });
    expect(window.lastShownDocument).toBeUndefined();
  });
});
