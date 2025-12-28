package handlers

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"

	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
	"github.com/jcom-dev/zmanim/internal/services"
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

// Magic bytes for image file validation
var (
	pngMagicBytes  = []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
	jpegMagicBytes = []byte{0xFF, 0xD8, 0xFF}
	webpMagicBytes = []byte{0x52, 0x49, 0x46, 0x46} // "RIFF" marker
)

// validateImageMagicBytes validates the file by checking magic bytes
func validateImageMagicBytes(data []byte) (string, bool) {
	if len(data) < 12 {
		return "", false
	}

	// Check PNG
	if len(data) >= len(pngMagicBytes) && string(data[:len(pngMagicBytes)]) == string(pngMagicBytes) {
		return "image/png", true
	}

	// Check JPEG
	if len(data) >= len(jpegMagicBytes) && string(data[:len(jpegMagicBytes)]) == string(jpegMagicBytes) {
		return "image/jpeg", true
	}

	// Check WebP (RIFF at start, WEBP at byte 8)
	if len(data) >= 12 && string(data[:4]) == string(webpMagicBytes) && string(data[8:12]) == "WEBP" {
		return "image/webp", true
	}

	return "", false
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

	// Read file content first for validation
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		RespondInternalError(w, r, "Failed to read file")
		return
	}

	// Validate file type by magic bytes (don't trust Content-Type header)
	detectedType, valid := validateImageMagicBytes(fileBytes)
	if !valid {
		RespondBadRequest(w, r, "Invalid file type. Only JPEG, PNG, and WebP images are allowed")
		return
	}

	// Use the detected MIME type from magic bytes
	contentType := detectedType

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

	// Log successful logo upload
	h.LogAuditEvent(ctx, r, pc, AuditEventParams{
		ActionType:   services.ActionProfileUpdate,
		ResourceType: "publisher_logo",
		ResourceID:   publisherID,
		ChangesAfter: map[string]interface{}{
			"logo_data_length": len(logoData),
			"content_type":     contentType,
		},
		Status: AuditStatusSuccess,
		AdditionalMetadata: map[string]interface{}{
			"file_size":    header.Size,
			"content_type": contentType,
		},
	})

	RespondJSON(w, r, http.StatusOK, map[string]interface{}{
		"logo_data": logoData,
		"message":   "Logo uploaded successfully",
	})
}
