package handlers

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"

	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

const (
	maxUploadSize = 5 * 1024 * 1024 // 5MB
)

var allowedMimeTypes = map[string]bool{
	"image/jpeg": true,
	"image/jpg":  true,
	"image/png":  true,
	"image/webp": true,
}

// UploadPublisherLogo handles logo upload for publishers
// Stores logo as base64 data URL directly in the database
func (h *Handlers) UploadPublisherLogo(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Step 1: Resolve publisher context
	pc := h.publisherResolver.MustResolve(w, r)
	if pc == nil {
		return // Response already sent
	}
	publisherID := pc.PublisherID

	// Parse multipart form
	err := r.ParseMultipartForm(maxUploadSize)
	if err != nil {
		RespondBadRequest(w, r, "File too large or invalid form data")
		return
	}

	// Get file from form
	file, header, err := r.FormFile("logo")
	if err != nil {
		RespondBadRequest(w, r, "No file provided")
		return
	}
	defer file.Close()

	// Validate file size
	if header.Size > maxUploadSize {
		RespondBadRequest(w, r, "File size exceeds 5MB limit")
		return
	}

	// Validate file type
	contentType := header.Header.Get("Content-Type")
	if !allowedMimeTypes[contentType] {
		RespondBadRequest(w, r, "Invalid file type. Only JPEG, PNG, and WebP are allowed")
		return
	}

	// Read file content
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		RespondInternalError(w, r, "Failed to read file")
		return
	}

	// Convert to base64 data URL
	base64Data := base64.StdEncoding.EncodeToString(fileBytes)
	dataURL := fmt.Sprintf("data:%s;base64,%s", contentType, base64Data)

	// Convert publisherID string to int32
	publisherIDInt, err := stringToInt32(publisherID)
	if err != nil {
		RespondBadRequest(w, r, "Invalid publisher ID")
		return
	}

	// Update publisher's logo_data in database
	result, err := h.db.Queries.UpdatePublisherLogo(ctx, sqlcgen.UpdatePublisherLogoParams{
		ID:       publisherIDInt,
		LogoData: &dataURL,
	})
	if err != nil {
		RespondInternalError(w, r, "Failed to update publisher profile")
		return
	}

	logoData := ""
	if result.LogoData != nil {
		logoData = *result.LogoData
	}

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"logo_data": logoData,
		"message":   "Logo uploaded successfully",
	})
}
