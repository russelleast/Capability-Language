# Playground

This directory contains the browser-only DCL playground integration for the
static website.

Current responsibilities include:

- Monaco editor setup and DCL language registration
- compiler WASM loading
- diagnostics rendering and Monaco markers
- semantic summary mapping
- example manifest loading
- shareable example links

## Manual Smoke Test

There is not yet an automated browser test harness for Monaco in this website.
After editor changes, run `npm run build`, then manually check the playground:

- Type `cap` and confirm the capability snippet appears near the top.
- Type `actor` and confirm the actor snippet appears near the top.
- Press Ctrl+Space or Cmd+Space and confirm DCL completions appear.
- Select a snippet and confirm Monaco inserts editable placeholders.
- Compile a valid example and confirm diagnostics clear.
- Introduce a source error, compile, and confirm diagnostics still appear in the
  panel and editor.
