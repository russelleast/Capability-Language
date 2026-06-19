package lsp

import "testing"

func TestDocumentStoreTracksOpenChangeSaveClose(t *testing.T) {
	store := NewDocumentStore()

	store.Open("file:///order.dcl", 1, "capability Order")
	document, ok := store.Get("file:///order.dcl")
	if !ok {
		t.Fatal("expected opened document")
	}
	if document.Version != 1 || document.Text != "capability Order" {
		t.Fatalf("unexpected opened document: %+v", document)
	}

	store.Change("file:///order.dcl", 2, "capability OrderFlow")
	document, ok = store.Get("file:///order.dcl")
	if !ok {
		t.Fatal("expected changed document")
	}
	if document.Version != 2 || document.Text != "capability OrderFlow" {
		t.Fatalf("unexpected changed document: %+v", document)
	}

	text := "capability SavedOrder"
	store.Save("file:///order.dcl", &text)
	document, ok = store.Get("file:///order.dcl")
	if !ok {
		t.Fatal("expected saved document")
	}
	if document.Version != 2 || document.Text != text {
		t.Fatalf("unexpected saved document: %+v", document)
	}

	store.Close("file:///order.dcl")
	if store.Count() != 0 {
		t.Fatalf("expected no open documents, got %d", store.Count())
	}
}
