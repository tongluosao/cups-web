package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"

	"cups-web/internal/ipp"
	"cups-web/internal/store"
)

var (
	errPrinterNotFound = errors.New("printer not found")
	errPrinterDenied   = errors.New("printer is not allowed")
)

type adminPrinterResponse struct {
	Name    string `json:"name"`
	URI     string `json:"uri"`
	Allowed bool   `json:"allowed"`
}

func printersHandler(w http.ResponseWriter, r *http.Request) {
	printers, err := listVisiblePrinters(r.Context())
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to list printers: "+err.Error())
		return
	}
	writeJSON(w, printers)
}

func adminPrintersHandler(w http.ResponseWriter, r *http.Request) {
	printers, allowlist, err := listPrintersWithAllowlist(r.Context())
	if err != nil {
		writeJSONError(w, http.StatusInternalServerError, "failed to list printers: "+err.Error())
		return
	}
	allowedSet := printerURISet(allowlist)
	resp := make([]adminPrinterResponse, 0, len(printers))
	for _, p := range printers {
		resp = append(resp, adminPrinterResponse{
			Name:    p.Name,
			URI:     p.URI,
			Allowed: len(allowedSet) == 0 || allowedSet[p.URI],
		})
	}
	writeJSON(w, resp)
}

func listVisiblePrinters(ctx context.Context) ([]ipp.Printer, error) {
	printers, allowlist, err := listPrintersWithAllowlist(ctx)
	if err != nil {
		return nil, err
	}
	return filterPrinters(printers, allowlist), nil
}

func listPrintersWithAllowlist(ctx context.Context) ([]ipp.Printer, []string, error) {
	printers, err := ipp.ListPrinters(cupsHost())
	if err != nil {
		return nil, nil, err
	}
	var allowlist []string
	err = appStore.WithTx(ctx, true, func(tx *sql.Tx) error {
		val, err := getPrinterAllowlist(ctx, tx)
		if err != nil {
			return err
		}
		allowlist = val
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return printers, allowlist, nil
}

func ensurePrinterAllowed(ctx context.Context, uri string) error {
	printers, allowlist, err := listPrintersWithAllowlist(ctx)
	if err != nil {
		return err
	}
	found := false
	for _, p := range printers {
		if p.URI == uri {
			found = true
			break
		}
	}
	if !found {
		return errPrinterNotFound
	}
	if len(allowlist) == 0 {
		return nil
	}
	if printerURISet(allowlist)[uri] {
		return nil
	}
	return errPrinterDenied
}

func validatePrinterAllowlist(ctx context.Context, values []string) error {
	cleaned := cleanPrinterURIs(values)
	if len(cleaned) == 0 {
		return nil
	}
	printers, err := ipp.ListPrinters(cupsHost())
	if err != nil {
		return err
	}
	existing := make(map[string]bool, len(printers))
	for _, p := range printers {
		existing[p.URI] = true
	}
	for _, uri := range cleaned {
		if !existing[uri] {
			return errPrinterNotFound
		}
	}
	return nil
}

func handlePrinterAccessError(w http.ResponseWriter, err error) bool {
	switch {
	case errors.Is(err, errPrinterNotFound):
		writeJSONError(w, http.StatusBadRequest, "printer not found")
		return true
	case errors.Is(err, errPrinterDenied):
		writeJSONError(w, http.StatusForbidden, "printer is not allowed")
		return true
	case err != nil:
		writeJSONError(w, http.StatusInternalServerError, "failed to validate printer: "+err.Error())
		return true
	default:
		return false
	}
}

func getPrinterAllowlist(ctx context.Context, tx *sql.Tx) ([]string, error) {
	raw, err := store.GetSettingString(ctx, tx, store.SettingPrinterAllowlist, "")
	if err != nil {
		return nil, err
	}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []string{}, nil
	}
	var values []string
	if err := json.Unmarshal([]byte(raw), &values); err != nil {
		return nil, err
	}
	return cleanPrinterURIs(values), nil
}

func setPrinterAllowlist(ctx context.Context, tx *sql.Tx, values []string) error {
	cleaned := cleanPrinterURIs(values)
	raw, err := json.Marshal(cleaned)
	if err != nil {
		return err
	}
	return store.SetSettingString(ctx, tx, store.SettingPrinterAllowlist, string(raw))
}

func filterPrinters(printers []ipp.Printer, allowlist []string) []ipp.Printer {
	if len(allowlist) == 0 {
		return printers
	}
	allowedSet := printerURISet(allowlist)
	filtered := make([]ipp.Printer, 0, len(printers))
	for _, p := range printers {
		if allowedSet[p.URI] {
			filtered = append(filtered, p)
		}
	}
	return filtered
}

func cleanPrinterURIs(values []string) []string {
	seen := map[string]bool{}
	cleaned := make([]string, 0, len(values))
	for _, value := range values {
		uri := strings.TrimSpace(value)
		if uri == "" || seen[uri] {
			continue
		}
		seen[uri] = true
		cleaned = append(cleaned, uri)
	}
	return cleaned
}

func printerURISet(values []string) map[string]bool {
	set := make(map[string]bool, len(values))
	for _, uri := range values {
		set[uri] = true
	}
	return set
}

func cupsHost() string {
	host := os.Getenv("CUPS_HOST")
	if host == "" {
		return "localhost"
	}
	return host
}
