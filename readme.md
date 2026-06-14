# DCL - Declarative Capability  Language

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Build](https://github.com/russelleast/Capability-Language/actions/workflows/build.yml/badge.svg)](https://github.com/russelleast/Capability-Language/actions/workflows/build.yml)

**DCL** (Declarative Capability  Language) is a modern language and compiler for modeling complex business processes using capability-driven design principles.

## 🎯 Overview

DCL enables organizations to:
- Define business capabilities and their interactions
- Model complex workflows and decision trees
- Enforce compliance and audit requirements
- Generate analyzable intermediate representations
- Support multiple output formats and integrations

The language focuses on clarity, safety, and semantic verification while maintaining backward compatibility with previous versions.

## 📦 Project Structure

```
dcl/
├── Capability-Language/   # Main language package
│   ├── compiler/          # Go compiler implementation
│   │   ├── cmd/           # Command-line interface
│   │   ├── internal/      # Compiler internals (lexer, parser, IR, etc.)
│   │   ├── pressure-tests/# Stress testing and performance benchmarks
│   │   └── go.mod         # Go module definition
│   ├── docs/              # Language documentation
│   ├── .github/           # GitHub workflows and configuration
│   └── .git/              # Repository root
├── site/                  # Web-based tools and documentation (coming soon)
├── vscode-extension/      # VS Code extension (coming soon)
└── README.md              # This file
```

## 🚀 Quick Start

### Prerequisites
- Go 1.22 or later

### Build and Run

```bash
cd Capability-Language/compiler
go run ./cmd/dcl --help
```

### Run DCL Files

```bash
cd Capability-Language/compiler
go run ./cmd/dcl check <file.dcl>
go run ./cmd/dcl ir <file.dcl> --format json
```

### Run Tests

```bash
cd Capability-Language/compiler
go test ./...
go test ./internal/compiler
```

## 📚 Language Documentation

See the [compiler README](./Capability-Language/compiler/README.md) for detailed syntax and authoring guidelines.

### DCL v0.9 Features

- **Improved Lifecycle Syntax**: Implicit ownership, simplified event handling
- **Built-in Types**: UUID, Email, Money
- **Effect Kinds**: Standardized noun-based declarations (notification, persistence, invocation)
- **Event Verification**: Capability-level event source ownership validation
- **Decision Trees**: Explicit outcome causation with `when` branches

Example:

```dcl
capability CollectPayment {
  events {
    emits PaymentReceived
  }

  lifecycle {
    begin Pending
    step AwaitingPayment waits for event PaymentReceived
    end Complete
  }
}
```

## 🛠️ Development

### Compiler Architecture

- **Lexer**: Tokenization and scanning
- **Parser**: Syntax analysis and AST construction
- **IR**: Intermediate representation for semantic analysis
- **Compiler**: Type checking, validation, and diagnostics

### Running Tests

```bash
cd Capability-Language/compiler
go test ./... -v
```

### Performance Testing

```bash
cd Capability-Language/compiler
go test ./pressure-tests/...
```

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 Planned Features

- [ ] Web-based IDE and playground
- [ ] VS Code extension with syntax highlighting and diagnostics
- [ ] Code generation for multiple backends (Go, TypeScript, etc.)
- [ ] Interactive documentation site
- [ ] LSP (Language Server Protocol) support

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 📞 Contact & Support

For questions, issues, or suggestions:
- **GitHub Issues**: [Report bugs or request features](../../issues)
- **Discussions**: [Join the community discussion](../../discussions)

## 🙏 Acknowledgments

Built with care for teams modeling complex business processes.

---

**Status**: Early development. API and syntax may change. Feedback is welcome!
