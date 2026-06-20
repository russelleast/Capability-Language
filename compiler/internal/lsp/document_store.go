package lsp

import "sync"

// Document tracks editor-owned text. The compiler remains responsible for
// parsing and semantic analysis once later LSP features need it.
type Document struct {
	URI     string
	Version int
	Text    string
}

type DocumentStore struct {
	mu        sync.RWMutex
	documents map[string]Document
}

func NewDocumentStore() *DocumentStore {
	return &DocumentStore{
		documents: make(map[string]Document),
	}
}

func (s *DocumentStore) Open(uri string, version int, text string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.documents[uri] = Document{URI: uri, Version: version, Text: text}
}

func (s *DocumentStore) Change(uri string, version int, text string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.documents[uri] = Document{URI: uri, Version: version, Text: text}
}

func (s *DocumentStore) Save(uri string, text *string) {
	if text == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	current := s.documents[uri]
	current.URI = uri
	current.Text = *text
	s.documents[uri] = current
}

func (s *DocumentStore) Close(uri string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.documents, uri)
}

func (s *DocumentStore) Get(uri string) (Document, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	document, ok := s.documents[uri]
	return document, ok
}

func (s *DocumentStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.documents)
}

func (s *DocumentStore) Snapshot() []Document {
	s.mu.RLock()
	defer s.mu.RUnlock()
	documents := make([]Document, 0, len(s.documents))
	for _, document := range s.documents {
		documents = append(documents, document)
	}
	return documents
}
