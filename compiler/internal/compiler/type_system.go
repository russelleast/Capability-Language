package compiler

import (
	"fmt"
	"math/big"
	"strings"

	"capabilitylanguage/internal/ast"
	"capabilitylanguage/internal/diagnostic"
	"capabilitylanguage/internal/ir"
)

func splitGenericType(name string) (string, string, bool) {
	open := strings.IndexByte(name, '<')
	if open <= 0 || !strings.HasSuffix(name, ">") {
		return name, "", false
	}
	return name[:open], name[open+1 : len(name)-1], true
}

func numericBase(name string) string {
	outer, _, generic := splitGenericType(name)
	if generic && (outer == "Integer" || outer == "Number") {
		return outer
	}
	if name == "Integer" || name == "Number" {
		return name
	}
	return ""
}

func (c *compiler) typeIR(name, context string) ir.TypeIR {
	outer, inner, generic := splitGenericType(name)
	if generic {
		switch outer {
		case "List":
			element := c.typeIR(inner, context)
			return ir.TypeIR{Kind: "collection", Name: "List", Element: &element}
		case "Integer", "Number":
			return ir.TypeIR{Kind: "measured_numeric", Numeric: outer, Measure: inner}
		default:
			return ir.TypeIR{Kind: "invalid", Name: name}
		}
	}
	if isBuiltinType(name) {
		return ir.TypeIR{Kind: "built_in", Name: name}
	}
	if info, ok := c.resolve("shape", name, context, diagnostic.Span{}, false); ok {
		kind := "record_shape"
		if shape, found := c.shapeDecl(info.Context, info.Name); found && shape.Kind == "enum" {
			kind = "enum_shape"
		}
		return ir.TypeIR{Kind: kind, Name: info.FQN}
	}
	return ir.TypeIR{Kind: "unresolved", Name: name}
}

func (c *compiler) shapeDecl(context, name string) (ast.ShapeDecl, bool) {
	for _, shape := range c.program.Shapes {
		if declContext(shape.Meta.ContextName) == declContext(context) && shape.Name == name {
			return shape, true
		}
	}
	return ast.ShapeDecl{}, false
}

func (c *compiler) enumAlternativesIR(shape ast.ShapeDecl) []ir.EnumAlternativeIR {
	out := make([]ir.EnumAlternativeIR, 0, len(shape.Alternatives))
	for _, alternative := range shape.Alternatives {
		item := ir.EnumAlternativeIR{Name: alternative.Name, PayloadType: alternative.PayloadType}
		if alternative.PayloadType != "" {
			payload := c.typeIR(alternative.PayloadType, shape.Meta.ContextName)
			item.Payload = &payload
		}
		out = append(out, item)
	}
	return out
}

func (c *compiler) validateEnumAlternatives(shape ast.ShapeDecl) {
	seen := map[string]diagnostic.Span{}
	for _, alternative := range shape.Alternatives {
		if old, exists := seen[alternative.Name]; exists {
			c.diags.Error("DCL_SEM_ENUM_ALTERNATIVE_DUPLICATE", fmt.Sprintf("duplicate enum alternative; first declared at %s:%d:%d", old.File, old.Line, old.Column), alternative.Span, alternative.Name)
		} else {
			seen[alternative.Name] = alternative.Span
		}
		if alternative.PayloadType != "" {
			c.validateEnumPayloadType(alternative.PayloadType, shape.Meta.ContextName, alternative.Span)
		}
	}
}

func (c *compiler) validateEnumPayloadType(name, context string, span diagnostic.Span) {
	if name == "" || isBuiltinType(name) {
		return
	}
	outer, inner, generic := splitGenericType(name)
	if generic {
		switch outer {
		case "List":
			c.validateEnumPayloadType(inner, context, span)
		case "Integer", "Number":
			c.requireInContext("measure", inner, context, span)
		default:
			c.diags.Error("DCL_SEM_TYPE_GENERIC_UNSUPPORTED", "only List<T>, Integer<Measure>, and Number<Measure> are valid generic types", span, name)
		}
		return
	}
	if _, ok := c.resolve("shape", name, context, span, false); !ok {
		c.diags.Error("DCL_SEM_UNKNOWN_TYPE", "unknown enum payload type", span, name)
	}
}

func (c *compiler) validateNumericConstraints(field ast.Field) {
	constraints := field.Constraints
	if constraints.Min == "" && constraints.Max == "" && constraints.Default == "" {
		return
	}
	base := numericBase(field.Type)
	if base == "" {
		c.diags.Error("DCL_SEM_NUMERIC_CONSTRAINT_TYPE", "min, max, and default constraints are only valid on Integer and Number fields", field.Span, field.Type)
		return
	}
	min, minOK := c.constraintNumber(constraints.Min, constraints.MinSpan, base, "min", field.Name)
	max, maxOK := c.constraintNumber(constraints.Max, constraints.MaxSpan, base, "max", field.Name)
	def, defOK := c.constraintNumber(constraints.Default, constraints.DefaultSpan, base, "default", field.Name)
	if constraints.Min != "" && constraints.Max != "" && minOK && maxOK && min.Cmp(max) > 0 {
		c.diags.Error("DCL_SEM_NUMERIC_RANGE_INVALID", "numeric field minimum must be less than or equal to its maximum", constraints.MaxSpan, field.Name)
	}
	if constraints.Default != "" && defOK {
		if constraints.Min != "" && minOK && def.Cmp(min) < 0 {
			c.diags.Error("DCL_SEM_NUMERIC_DEFAULT_OUT_OF_RANGE", "numeric field default is below its minimum", constraints.DefaultSpan, field.Name)
		}
		if constraints.Max != "" && maxOK && def.Cmp(max) > 0 {
			c.diags.Error("DCL_SEM_NUMERIC_DEFAULT_OUT_OF_RANGE", "numeric field default is above its maximum", constraints.DefaultSpan, field.Name)
		}
	}
}

func (c *compiler) constraintNumber(value string, span diagnostic.Span, base, constraint, field string) (*big.Rat, bool) {
	if value == "" {
		return nil, false
	}
	number, ok := new(big.Rat).SetString(value)
	if !ok {
		c.diags.Error("DCL_SEM_NUMERIC_CONSTRAINT_INVALID", constraint+" must be a valid numeric value", span, field)
		return nil, false
	}
	if base == "Integer" && !number.IsInt() {
		code := "DCL_SEM_INTEGER_CONSTRAINT_FRACTIONAL"
		message := "Integer " + constraint + " cannot contain a fractional value"
		if constraint == "default" {
			code = "DCL_SEM_INTEGER_DEFAULT_FRACTIONAL"
			message = "Integer default cannot contain a fractional value"
		}
		c.diags.Error(code, message, span, field)
		return nil, false
	}
	return number, true
}

func (c *compiler) validateTypeNamespace() {
	measures := map[string]ast.MeasureDecl{}
	for _, measure := range c.program.Measures {
		measures[symbolIdentity(measure.Meta.ContextName, measure.Name)] = measure
	}
	for _, shape := range c.program.Shapes {
		if measure, exists := measures[symbolIdentity(shape.Meta.ContextName, shape.Name)]; exists {
			c.diags.Error("DCL_SEM_DUPLICATE_TYPE", fmt.Sprintf("type name is already used by measure declared at %s:%d:%d", measure.Span.File, measure.Span.Line, measure.Span.Column), shape.Span, shape.Name)
		}
	}
}
