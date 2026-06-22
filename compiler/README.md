### Build and Run

Current versions: DCL language v1.0; compiler v0.1.0.

```bash
cd Capability-Language/compiler
go run ./cmd/dcl --help
go run ./cmd/dcl version
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
