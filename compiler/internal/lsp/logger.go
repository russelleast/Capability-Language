package lsp

import (
	"encoding/json"
	"fmt"
	"io"
	"sync"
	"time"
)

type Logger struct {
	mu  sync.Mutex
	out io.Writer
}

func NewLogger(out io.Writer) *Logger {
	return &Logger{out: out}
}

func (l *Logger) Event(event string, fields map[string]any) {
	if l == nil || l.out == nil {
		return
	}
	record := map[string]any{
		"ts":    time.Now().UTC().Format(time.RFC3339Nano),
		"event": event,
	}
	for key, value := range fields {
		record[key] = value
	}
	payload, err := json.Marshal(record)
	if err != nil {
		payload = []byte(fmt.Sprintf(`{"event":%q,"logError":%q}`, event, err.Error()))
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	_, _ = l.out.Write(append(payload, '\n'))
}
