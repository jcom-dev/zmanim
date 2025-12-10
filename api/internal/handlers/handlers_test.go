package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jcom-dev/zmanim/internal/middleware"
)

// TestHelper provides utilities for handler testing
type TestHelper struct {
	t *testing.T
}

func NewTestHelper(t *testing.T) *TestHelper {
	return &TestHelper{t: t}
}

// MakeRequest creates a request with common test setup
func (h *TestHelper) MakeRequest(method, path string, body interface{}) *http.Request {
	var req *http.Request
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			h.t.Fatalf("failed to marshal body: %v", err)
		}
		req = httptest.NewRequest(method, path, bytes.NewReader(jsonBody))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, path, nil)
	}
	return req
}

// AddAuthContext adds user authentication context to a request
func (h *TestHelper) AddAuthContext(req *http.Request, userID, role string) *http.Request {
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	ctx = context.WithValue(ctx, middleware.UserRoleKey, role)
	return req.WithContext(ctx)
}

// AddPublisherHeader adds publisher ID header to a request
func (h *TestHelper) AddPublisherHeader(req *http.Request, publisherID string) *http.Request {
	req.Header.Set("X-Publisher-Id", publisherID)
	return req
}

// AddChiURLParams adds chi URL params to a request context
func (h *TestHelper) AddChiURLParams(req *http.Request, params map[string]string) *http.Request {
	rctx := chi.NewRouteContext()
	for key, value := range params {
		rctx.URLParams.Add(key, value)
	}
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

// ParseJSONResponse parses a JSON response into the given interface
func (h *TestHelper) ParseJSONResponse(w *httptest.ResponseRecorder, v interface{}) {
	if err := json.Unmarshal(w.Body.Bytes(), v); err != nil {
		h.t.Fatalf("failed to parse response: %v", err)
	}
}

// AssertStatus asserts the response status code
func (h *TestHelper) AssertStatus(w *httptest.ResponseRecorder, expected int) {
	if w.Code != expected {
		h.t.Errorf("expected status %d, got %d. Body: %s", expected, w.Code, w.Body.String())
	}
}

// AssertJSONResponse asserts common JSON response structure
func (h *TestHelper) AssertJSONResponse(w *httptest.ResponseRecorder) {
	contentType := w.Header().Get("Content-Type")
	if contentType != "application/json" {
		h.t.Errorf("expected Content-Type 'application/json', got '%s'", contentType)
	}
}

// =============================================================================
// Response Helpers Tests
// =============================================================================

func TestRespondJSON_Success(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	data := map[string]string{"message": "hello"}

	RespondJSON(w, req, http.StatusOK, data)

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusOK)
	helper.AssertJSONResponse(w)

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	dataMap := response.Data.(map[string]interface{})
	if dataMap["message"] != "hello" {
		t.Errorf("expected message 'hello', got '%v'", dataMap["message"])
	}
	if response.Meta == nil {
		t.Error("expected meta field in response")
	}
}

func TestRespondJSON_WithMeta(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	data := map[string]string{"name": "test"}

	RespondJSON(w, req, http.StatusOK, data)

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusOK)

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	if response.Meta == nil {
		t.Error("expected meta field in response")
	}
	if response.Meta.Timestamp == "" {
		t.Error("expected timestamp in meta")
	}
}

func TestRespondError_BadRequest(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	RespondBadRequest(w, req, "Invalid input")

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusBadRequest)

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	if response.Error == nil {
		t.Fatal("expected error field in response")
	}
	if response.Error.Code != "BAD_REQUEST" {
		t.Errorf("expected error code 'BAD_REQUEST', got '%v'", response.Error.Code)
	}
	if response.Error.Message != "Invalid input" {
		t.Errorf("expected message 'Invalid input', got '%v'", response.Error.Message)
	}
}

func TestRespondError_Unauthorized(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	RespondUnauthorized(w, req, "Not authenticated")

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusUnauthorized)

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	if response.Error.Code != "UNAUTHORIZED" {
		t.Errorf("expected error code 'UNAUTHORIZED', got '%v'", response.Error.Code)
	}
}

func TestRespondError_Forbidden(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	RespondForbidden(w, req, "Access denied")

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusForbidden)

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	if response.Error.Code != "FORBIDDEN" {
		t.Errorf("expected error code 'FORBIDDEN', got '%v'", response.Error.Code)
	}
}

func TestRespondError_NotFound(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	RespondNotFound(w, req, "Resource not found")

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusNotFound)

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	if response.Error.Code != "NOT_FOUND" {
		t.Errorf("expected error code 'NOT_FOUND', got '%v'", response.Error.Code)
	}
}

func TestRespondError_InternalError(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	RespondInternalError(w, req, "Something went wrong")

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusInternalServerError)

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	if response.Error.Code != "INTERNAL_ERROR" {
		t.Errorf("expected error code 'INTERNAL_ERROR', got '%v'", response.Error.Code)
	}
}

func TestRespondError_Conflict(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	RespondConflict(w, req, "Resource already exists")

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusConflict)

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	if response.Error.Code != "CONFLICT" {
		t.Errorf("expected error code 'CONFLICT', got '%v'", response.Error.Code)
	}
}

func TestRespondError_ValidationError(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	details := map[string]string{"field": "email", "reason": "invalid format"}

	RespondValidationError(w, req, "Validation failed", details)

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusBadRequest)

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	if response.Error.Code != "VALIDATION_ERROR" {
		t.Errorf("expected error code 'VALIDATION_ERROR', got '%v'", response.Error.Code)
	}
	if response.Error.Details == nil {
		t.Error("expected details in error response")
	}
}

func TestRespondError_RateLimited(t *testing.T) {
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	RespondRateLimited(w, req, 60)

	helper := NewTestHelper(t)
	helper.AssertStatus(w, http.StatusTooManyRequests)

	// Check Retry-After header
	retryAfter := w.Header().Get("Retry-After")
	if retryAfter != "60" {
		t.Errorf("expected Retry-After header '60', got '%s'", retryAfter)
	}

	var response APIResponse
	helper.ParseJSONResponse(w, &response)

	if response.Error.Code != "RATE_LIMITED" {
		t.Errorf("expected error code 'RATE_LIMITED', got '%v'", response.Error.Code)
	}
}

// =============================================================================
// Pagination Tests
// =============================================================================

// parsePagination is a helper that extracts pagination from request query params
func parsePagination(r *http.Request, defaultPageSize, maxPageSize int) (page int, pageSize int) {
	page = 1
	pageSize = defaultPageSize

	if pageStr := r.URL.Query().Get("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	if pageSizeStr := r.URL.Query().Get("page_size"); pageSizeStr != "" {
		if ps, err := strconv.Atoi(pageSizeStr); err == nil && ps > 0 {
			pageSize = ps
			if pageSize > maxPageSize {
				pageSize = maxPageSize
			}
		}
	}

	return page, pageSize
}

func TestParsePagination_DefaultValues(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	page, pageSize := parsePagination(req, 20, 100)

	if page != 1 {
		t.Errorf("expected default page 1, got %d", page)
	}
	if pageSize != 20 {
		t.Errorf("expected default pageSize 20, got %d", pageSize)
	}
}

func TestParsePagination_CustomValues(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test?page=3&page_size=50", nil)

	page, pageSize := parsePagination(req, 20, 100)

	if page != 3 {
		t.Errorf("expected page 3, got %d", page)
	}
	if pageSize != 50 {
		t.Errorf("expected pageSize 50, got %d", pageSize)
	}
}

func TestParsePagination_MaxPageSize(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test?page_size=200", nil)

	_, pageSize := parsePagination(req, 20, 100)

	if pageSize != 100 {
		t.Errorf("expected max pageSize 100, got %d", pageSize)
	}
}

func TestParsePagination_InvalidValues(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test?page=-1&page_size=abc", nil)

	page, pageSize := parsePagination(req, 20, 100)

	// Should fall back to defaults for invalid values
	if page != 1 {
		t.Errorf("expected default page 1 for invalid input, got %d", page)
	}
	if pageSize != 20 {
		t.Errorf("expected default pageSize 20 for invalid input, got %d", pageSize)
	}
}

// =============================================================================
// Test Helper Tests
// =============================================================================

func TestTestHelper_AddAuthContext(t *testing.T) {
	helper := NewTestHelper(t)
	req := helper.MakeRequest(http.MethodGet, "/test", nil)
	req = helper.AddAuthContext(req, "user-123", "publisher")

	userID := middleware.GetUserID(req.Context())
	if userID != "user-123" {
		t.Errorf("expected userID 'user-123', got '%s'", userID)
	}

	role := middleware.GetUserRole(req.Context())
	if role != "publisher" {
		t.Errorf("expected role 'publisher', got '%s'", role)
	}
}

func TestTestHelper_AddPublisherHeader(t *testing.T) {
	helper := NewTestHelper(t)
	req := helper.MakeRequest(http.MethodGet, "/test", nil)
	req = helper.AddPublisherHeader(req, "pub-456")

	pubID := req.Header.Get("X-Publisher-Id")
	if pubID != "pub-456" {
		t.Errorf("expected publisher ID 'pub-456', got '%s'", pubID)
	}
}

func TestTestHelper_AddChiURLParams(t *testing.T) {
	helper := NewTestHelper(t)
	req := helper.MakeRequest(http.MethodGet, "/test", nil)
	req = helper.AddChiURLParams(req, map[string]string{
		"id":   "123",
		"name": "test",
	})

	rctx := chi.RouteContext(req.Context())
	if rctx == nil {
		t.Fatal("expected chi route context")
	}
	if rctx.URLParam("id") != "123" {
		t.Errorf("expected id '123', got '%s'", rctx.URLParam("id"))
	}
	if rctx.URLParam("name") != "test" {
		t.Errorf("expected name 'test', got '%s'", rctx.URLParam("name"))
	}
}

// =============================================================================
// Benchmark Tests
// =============================================================================

func BenchmarkRespondJSON(b *testing.B) {
	data := map[string]string{"message": "hello", "status": "success"}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		RespondJSON(w, req, http.StatusOK, data)
	}
}

func BenchmarkRespondError(b *testing.B) {
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		RespondBadRequest(w, req, "Invalid input")
	}
}
