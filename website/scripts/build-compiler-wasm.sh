#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd "${WEBSITE_DIR}/.." && pwd)"
OUT_DIR="${WEBSITE_DIR}/public/compiler"
GOCACHE_DIR="${WEBSITE_DIR}/.cache/go-build"
GOROOT="$(go env GOROOT)"

mkdir -p "${OUT_DIR}"
mkdir -p "${GOCACHE_DIR}"

cp "${GOROOT}/lib/wasm/wasm_exec.js" "${OUT_DIR}/wasm_exec.js"

(
  cd "${REPO_DIR}/compiler"
  GOCACHE="${GOCACHE_DIR}" GOOS=js GOARCH=wasm go build -o "${OUT_DIR}/dcl.wasm" ./cmd/dclwasm
)
