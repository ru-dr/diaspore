package protocol

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// compileSchema loads a schema from the repo's schema directory by name.
func compileSchema(t *testing.T, name string) *jsonschema.Schema {
	t.Helper()
	f, err := os.Open(filepath.Join("..", "..", "schema", name))
	if err != nil {
		t.Fatalf("open %s: %v", name, err)
	}
	defer f.Close()
	doc, err := jsonschema.UnmarshalJSON(f)
	if err != nil {
		t.Fatalf("parse %s: %v", name, err)
	}
	// Register under a fixed URL so paths with spaces or Windows drives never matter.
	url := "https://github.com/ru-dr/diaspore/schema/" + name
	c := jsonschema.NewCompiler()
	if err := c.AddResource(url, doc); err != nil {
		t.Fatalf("add %s: %v", name, err)
	}
	sch, err := c.Compile(url)
	if err != nil {
		t.Fatalf("compile %s: %v", name, err)
	}
	return sch
}

// schemaCheck validates raw JSON against a compiled schema.
func schemaCheck(sch *jsonschema.Schema, raw []byte) error {
	inst, err := jsonschema.UnmarshalJSON(bytes.NewReader(raw))
	if err != nil {
		return err
	}
	return sch.Validate(inst)
}

// goCheck runs the Go decoder that matches an example's kind.
func goCheck(kind string, raw []byte) error {
	if kind == "event" {
		_, err := DecodeEvent(raw)
		return err
	}
	_, err := DecodeReply(raw)
	return err
}

// TestExamplesAgree checks every example file against both the schema and the Go decoder.
func TestExamplesAgree(t *testing.T) {
	schemas := map[string]*jsonschema.Schema{
		"event": compileSchema(t, "event.schema.json"),
		"reply": compileSchema(t, "reply.schema.json"),
	}
	files, err := filepath.Glob(filepath.Join("testdata", "*", "*.json"))
	if err != nil || len(files) == 0 {
		t.Fatalf("no example files found: %v", err)
	}
	for _, path := range files {
		t.Run(filepath.ToSlash(path), func(t *testing.T) {
			wantValid := filepath.Base(filepath.Dir(path)) == "valid"
			kind, _, _ := strings.Cut(filepath.Base(path), "_")
			sch, ok := schemas[kind]
			if !ok {
				t.Fatalf("file name must start with event_ or reply_")
			}
			raw, err := os.ReadFile(path)
			if err != nil {
				t.Fatal(err)
			}
			if err := schemaCheck(sch, raw); (err == nil) != wantValid {
				t.Errorf("schema: want valid=%v, got error: %v", wantValid, err)
			}
			if err := goCheck(kind, raw); (err == nil) != wantValid {
				t.Errorf("Go decoder: want valid=%v, got error: %v", wantValid, err)
			}
		})
	}
}

// TestEnoughBrokenExamples enforces the build guide's minimum of 5 invalid examples.
func TestEnoughBrokenExamples(t *testing.T) {
	files, _ := filepath.Glob(filepath.Join("testdata", "invalid", "*.json"))
	if len(files) < 5 {
		t.Fatalf("need at least 5 invalid examples, found %d", len(files))
	}
}

// TestEncodedEventsMatchSchema checks that events Diaspore builds in Go pass the schema.
func TestEncodedEventsMatchSchema(t *testing.T) {
	sch := compileSchema(t, "event.schema.json")
	events := []any{
		NewInit("n1", nil, 0, 0, nil),
		NewInit("n1", []string{"n2", "n3"}, MaxInt, 1900000, map[string]string{"term": "1"}),
		NewMessage(1250, "c1", json.RawMessage(`{"op":"put","key":"x","value":5}`)),
		NewTimer(1750, "election"),
	}
	for _, e := range events {
		raw, err := json.Marshal(e)
		if err != nil {
			t.Fatal(err)
		}
		if err := schemaCheck(sch, raw); err != nil {
			t.Errorf("%s fails the schema: %v", raw, err)
		}
	}
}
