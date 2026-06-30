GO ?= go
NODE ?= node

MCP_BIN ?= $(CURDIR)/bin/dcl-mcp

.PHONY: build-mcp install-mcp mcp-config test-mcp

build-mcp:
	@mkdir -p "$(dir $(MCP_BIN))"
	@cd compiler && $(GO) build -o "$(MCP_BIN)" ./cmd/dcl-mcp
	@chmod +x "$(MCP_BIN)"
	@printf 'Built DCL MCP server: %s\n' "$(MCP_BIN)"

install-mcp: build-mcp
	@printf '\nDCL MCP server installed at:\n  %s\n\n' "$(MCP_BIN)"
	@printf 'VS Code / Copilot MCP configuration:\n'
	@$(MAKE) --no-print-directory mcp-config
	@printf '\nAdd this JSON to .vscode/mcp.json or to the VS Code MCP settings, then reload VS Code.\n'

mcp-config:
	@printf '{\n'
	@printf '  "servers": {\n'
	@printf '    "dcl": {\n'
	@printf '      "type": "stdio",\n'
	@printf '      "command": "%s"\n' "$(MCP_BIN)"
	@printf '    }\n'
	@printf '  }\n'
	@printf '}\n'

test-mcp: build-mcp
	@test -f "$(MCP_BIN)" || { echo "Missing MCP binary: $(MCP_BIN)" >&2; exit 1; }
	@test -x "$(MCP_BIN)" || { echo "MCP binary is not executable: $(MCP_BIN)" >&2; exit 1; }
	@cd compiler && $(NODE) scripts/mcp-smoke.mjs "$(MCP_BIN)"
