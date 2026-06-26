package source

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"capabilitylanguage/internal/compiler"
)

type Request struct {
	Source   string
	Filename string
	Path     string
	Paths    []string
}

func Load(request Request) ([]compiler.SourceFile, error) {
	hasSource := strings.TrimSpace(request.Source) != ""
	hasPath := strings.TrimSpace(request.Path) != "" || len(request.Paths) > 0
	if hasSource && hasPath {
		return nil, errors.New("provide either source or path/paths, not both")
	}
	if hasSource {
		filename := request.Filename
		if filename == "" {
			filename = "inline.dcl"
		}
		return []compiler.SourceFile{{Path: filename, Text: request.Source}}, nil
	}
	if !hasPath {
		return nil, errors.New("provide source, path, or paths")
	}
	paths := append([]string(nil), request.Paths...)
	if request.Path != "" {
		paths = append(paths, request.Path)
	}
	return LoadPaths(paths)
}

func LoadPaths(paths []string) ([]compiler.SourceFile, error) {
	seen := map[string]bool{}
	var sources []compiler.SourceFile
	for _, item := range paths {
		if strings.TrimSpace(item) == "" {
			continue
		}
		loaded, err := loadPath(item)
		if err != nil {
			return nil, err
		}
		for _, source := range loaded {
			if seen[source.Path] {
				continue
			}
			seen[source.Path] = true
			sources = append(sources, source)
		}
	}
	sort.SliceStable(sources, func(i, j int) bool {
		return sources[i].Path < sources[j].Path
	})
	if len(sources) == 0 {
		return nil, errors.New("no .dcl sources found")
	}
	return sources, nil
}

func loadPath(path string) ([]compiler.SourceFile, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		if filepath.Ext(path) != ".dcl" {
			return nil, fmt.Errorf("%s is not a .dcl file", path)
		}
		source, err := readSource(path)
		if err != nil {
			return nil, err
		}
		return []compiler.SourceFile{source}, nil
	}

	var sources []compiler.SourceFile
	err = filepath.WalkDir(path, func(item string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() {
			if entry.Name() == ".git" || entry.Name() == "node_modules" {
				return filepath.SkipDir
			}
			return nil
		}
		if filepath.Ext(item) != ".dcl" {
			return nil
		}
		source, err := readSource(item)
		if err != nil {
			return err
		}
		sources = append(sources, source)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return sources, nil
}

func readSource(path string) (compiler.SourceFile, error) {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return compiler.SourceFile{}, err
	}
	payload, err := os.ReadFile(absolute)
	if err != nil {
		return compiler.SourceFile{}, err
	}
	return compiler.SourceFile{Path: absolute, Text: string(payload)}, nil
}
