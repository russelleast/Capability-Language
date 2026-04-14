# DCL Compiler

## Running and Testing

```bash

go run ./cmd/dcl

go test ./...
go test ./internal/compiler

```

examples: 

```bash
go run ./cmd/dcl check some-file.dcl
go run ./cmd/dcl ir some-file.dcl --format json
```