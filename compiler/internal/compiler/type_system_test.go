package compiler

import "testing"

func TestDomainTypeSystemIsPreservedInIR(t *testing.T) {
	src := `language dcl 1.1
measure Quantity
measure Weight

shape Address {
  line1: Text required
}

shape Failure {
  reason: Text required
}

shape PaymentMethod enum {
  Cash
  Reference is Text
  Failed is List<Failure>
}

shape OrderLine {
  address: Address required
  quantity: Integer<Quantity> min 1 max 100 default 1 required
  weight: Number<Weight> min 0 default 1.5
  payment: PaymentMethod required
}

actor Customer is human
capability PlaceOrder {
  intent OrderLine from Customer
  outcome Accepted is PaymentMethod
  when { otherwise then Accepted }
}`
	result := CompileSource("types.dcl", src)
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	if len(result.IR.Measures) != 2 {
		t.Fatalf("expected measures in IR, got %#v", result.IR.Measures)
	}
	shapes := map[string]int{}
	for i, shape := range result.IR.Shapes {
		shapes[shape.Name] = i
	}
	enum := result.IR.Shapes[shapes["PaymentMethod"]]
	if enum.Kind != "enum" || len(enum.Alternatives) != 3 {
		t.Fatalf("expected enum alternatives, got %#v", enum)
	}
	if enum.Alternatives[2].Payload == nil || enum.Alternatives[2].Payload.Kind != "collection" || enum.Alternatives[2].Payload.Element.Kind != "record_shape" {
		t.Fatalf("expected structured collection payload type, got %#v", enum.Alternatives[2])
	}
	record := result.IR.Shapes[shapes["OrderLine"]]
	fields := map[string]int{}
	for i, field := range record.Fields {
		fields[field.Name] = i
	}
	quantity := record.Fields[fields["quantity"]]
	if quantity.TypeRef.Kind != "measured_numeric" || quantity.TypeRef.Numeric != "Integer" || quantity.TypeRef.Measure != "Quantity" {
		t.Fatalf("expected measured Integer type, got %#v", quantity.TypeRef)
	}
	if quantity.Constraints.Min != "1" || quantity.Constraints.Max != "100" || quantity.Constraints.Default != "1" {
		t.Fatalf("expected numeric constraints, got %#v", quantity.Constraints)
	}
	if record.Fields[fields["payment"]].TypeRef.Kind != "enum_shape" {
		t.Fatalf("expected named enum field type, got %#v", record.Fields[fields["payment"]].TypeRef)
	}
}

func TestDomainTypeDiagnostics(t *testing.T) {
	tests := []struct {
		name string
		src  string
		code string
	}{
		{"fractional integer default", "shape Value { value: Integer default 1.5 }", "DCL_SEM_INTEGER_DEFAULT_FRACTIONAL"},
		{"invalid range", "shape Value { value: Integer min 10 max 5 }", "DCL_SEM_NUMERIC_RANGE_INVALID"},
		{"default above max", "shape Value { value: Integer min 1 max 10 default 20 }", "DCL_SEM_NUMERIC_DEFAULT_OUT_OF_RANGE"},
		{"duplicate enum alternative", "shape Result enum {\n Success\n Success\n}", "DCL_SEM_ENUM_ALTERNATIVE_DUPLICATE"},
		{"unknown enum payload", "shape Result enum {\n Failure is UnknownType\n}", "DCL_SEM_UNKNOWN_TYPE"},
		{"unknown measure", "shape Value { value: Integer<Missing> }", "DCL_SEM_UNKNOWN_MEASURE"},
		{"constraint on text", "shape Value { value: Text min 1 }", "DCL_SEM_NUMERIC_CONSTRAINT_TYPE"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CompileSource("invalid.dcl", tt.src)
			assertDiagnostic(t, result.Diagnostics, tt.code)
		})
	}
}

func TestIntegerIsDistinctFromNumber(t *testing.T) {
	result := CompileSource("numbers.dcl", `shape Values {
  count: Integer
  ratio: Number
}`)
	if HasErrors(result.Diagnostics) {
		t.Fatalf("unexpected diagnostics: %#v", result.Diagnostics)
	}
	fields := result.IR.Shapes[0].Fields
	if fields[0].TypeRef.Name != "Integer" || fields[1].TypeRef.Name != "Number" {
		t.Fatalf("expected distinct built-in types, got %#v", fields)
	}
}

func TestDomainTypeDeclarationsAndReferencesAreIndexed(t *testing.T) {
	source := SourceFile{Path: "navigation.dcl", Text: `measure Quantity
shape Address { line1: Text }
shape OrderLine {
  address: Address
  quantity: Integer<Quantity>
}`}
	index := NewSemanticSourceIndex([]SourceFile{source})
	want := map[string]bool{"measure:declaration:Quantity": false, "measure:reference:Quantity": false, "shape:reference:Address": false}
	for _, entry := range index.Entries() {
		key := entry.Kind + ":" + string(entry.Role) + ":" + entry.Name
		if _, ok := want[key]; ok {
			want[key] = true
		}
	}
	for key, found := range want {
		if !found {
			t.Fatalf("missing semantic source entry %s in %#v", key, index.Entries())
		}
	}
}
