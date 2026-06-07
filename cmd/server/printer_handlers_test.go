package main

import (
	"testing"

	"cups-web/internal/ipp"
)

func TestFilterPrintersEmptyAllowlistReturnsAll(t *testing.T) {
	printers := []ipp.Printer{
		{Name: "A", URI: "http://cups/printers/a"},
		{Name: "B", URI: "http://cups/printers/b"},
	}

	got := filterPrinters(printers, nil)
	if len(got) != len(printers) {
		t.Fatalf("expected all printers, got %d", len(got))
	}
}

func TestFilterPrintersAllowlist(t *testing.T) {
	printers := []ipp.Printer{
		{Name: "A", URI: "http://cups/printers/a"},
		{Name: "B", URI: "http://cups/printers/b"},
	}

	got := filterPrinters(printers, []string{"http://cups/printers/b"})
	if len(got) != 1 || got[0].URI != "http://cups/printers/b" {
		t.Fatalf("unexpected filtered printers: %#v", got)
	}
}

func TestCleanPrinterURIs(t *testing.T) {
	got := cleanPrinterURIs([]string{
		" http://cups/printers/a ",
		"",
		"http://cups/printers/a",
		"http://cups/printers/b",
	})
	want := []string{"http://cups/printers/a", "http://cups/printers/b"}
	if len(got) != len(want) {
		t.Fatalf("len mismatch: got %#v want %#v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %#v want %#v", got, want)
		}
	}
}
