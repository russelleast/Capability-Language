#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd "${WEBSITE_DIR}/.." && pwd)"
OUT_DIR="${WEBSITE_DIR}/public/compiler"
GOCACHE_DIR="${WEBSITE_DIR}/.cache/go-build"
GOROOT="$(go env GOROOT)"
WASM_EXEC=""

mkdir -p "${OUT_DIR}"
mkdir -p "${GOCACHE_DIR}"

for candidate in \
  "${GOROOT}/lib/wasm/wasm_exec.js" \
  "${GOROOT}/misc/wasm/wasm_exec.js"
do
  if [[ -f "${candidate}" ]]; then
    WASM_EXEC="${candidate}"
    break
  fi
done

if [[ -z "${WASM_EXEC}" ]]; then
  echo "wasm_exec.js was not found under GOROOT=${GOROOT}" >&2
  exit 1
fi

cp "${WASM_EXEC}" "${OUT_DIR}/wasm_exec.js"

(
  cd "${REPO_DIR}/compiler"
  GOCACHE="${GOCACHE_DIR}" GOOS=js GOARCH=wasm go build -o "${OUT_DIR}/dcl.wasm" ./cmd/dclwasm
)
