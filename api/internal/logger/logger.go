// Package logger provides structured logging utilities for the Shtetl Zmanim API.
// Built on slog with JSON output for production and text output for development.
package logger

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"os"
	"runtime"
	"time"
)

// contextKey is used for context value storage
type contextKey string

const (
	// Context keys
	requestIDKey contextKey = "request_id"
	userIDKey    contextKey = "user_id"
	publisherKey contextKey = "publisher_id"
)

var (
	// Default is the default logger instance
	Default *slog.Logger
)

// Config holds logger configuration
type Config struct {
	// Level is the minimum log level (debug, info, warn, error)
	Level string
	// Format is the output format (json, text)
	Format string
	// Output is the output writer (defaults to os.Stdout)
	Output io.Writer
	// AddSource adds source code location to log entries
	AddSource bool
}

// Init initializes the default logger with the given configuration
func Init(cfg Config) {
	level := parseLevel(cfg.Level)
	output := cfg.Output
	if output == nil {
		output = os.Stdout
	}

	opts := &slog.HandlerOptions{
		Level:     level,
		AddSource: cfg.AddSource,
	}

	var handler slog.Handler
	if cfg.Format == "json" {
		handler = slog.NewJSONHandler(output, opts)
	} else {
		handler = slog.NewTextHandler(output, opts)
	}

	Default = slog.New(handler)
	slog.SetDefault(Default)
}

func parseLevel(level string) slog.Level {
	switch level {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// =============================================================================
// Context Utilities
// =============================================================================

// WithRequestID adds a request ID to the context
func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, requestIDKey, requestID)
}

// WithUserID adds a user ID to the context
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userIDKey, userID)
}

// WithPublisherID adds a publisher ID to the context
func WithPublisherID(ctx context.Context, publisherID string) context.Context {
	return context.WithValue(ctx, publisherKey, publisherID)
}

// GetRequestID retrieves the request ID from context
func GetRequestID(ctx context.Context) string {
	if id, ok := ctx.Value(requestIDKey).(string); ok {
		return id
	}
	return ""
}

// GetUserID retrieves the user ID from context
func GetUserID(ctx context.Context) string {
	if id, ok := ctx.Value(userIDKey).(string); ok {
		return id
	}
	return ""
}

// GetPublisherID retrieves the publisher ID from context
func GetPublisherID(ctx context.Context) string {
	if id, ok := ctx.Value(publisherKey).(string); ok {
		return id
	}
	return ""
}

// =============================================================================
// Logger with Context
// =============================================================================

// FromContext returns a logger with context values added as attributes
func FromContext(ctx context.Context) *slog.Logger {
	if Default == nil {
		return slog.Default()
	}

	logger := Default
	if reqID := GetRequestID(ctx); reqID != "" {
		logger = logger.With("request_id", reqID)
	}
	if userID := GetUserID(ctx); userID != "" {
		logger = logger.With("user_id", userID)
	}
	if pubID := GetPublisherID(ctx); pubID != "" {
		logger = logger.With("publisher_id", pubID)
	}

	return logger
}

// =============================================================================
// Convenience Methods
// =============================================================================

// Debug logs at debug level
func Debug(msg string, args ...any) {
	if Default != nil {
		Default.Debug(msg, args...)
	} else {
		slog.Debug(msg, args...)
	}
}

// Info logs at info level
func Info(msg string, args ...any) {
	if Default != nil {
		Default.Info(msg, args...)
	} else {
		slog.Info(msg, args...)
	}
}

// Warn logs at warn level
func Warn(msg string, args ...any) {
	if Default != nil {
		Default.Warn(msg, args...)
	} else {
		slog.Warn(msg, args...)
	}
}

// Error logs at error level
func Error(msg string, args ...any) {
	if Default != nil {
		Default.Error(msg, args...)
	} else {
		slog.Error(msg, args...)
	}
}

// =============================================================================
// HTTP Request Logging
// =============================================================================

// RequestLogEntry contains data for HTTP request logging
type RequestLogEntry struct {
	Method       string
	Path         string
	RemoteAddr   string
	UserAgent    string
	RequestID    string
	UserID       string
	PublisherID  string
	StatusCode   int
	ResponseSize int64
	Duration     time.Duration
}

// LogRequest logs an HTTP request with standard fields
func LogRequest(ctx context.Context, entry RequestLogEntry) {
	logger := FromContext(ctx)

	attrs := []any{
		"method", entry.Method,
		"path", entry.Path,
		"status", entry.StatusCode,
		"duration_ms", entry.Duration.Milliseconds(),
	}

	if entry.RemoteAddr != "" {
		attrs = append(attrs, "remote_addr", entry.RemoteAddr)
	}
	if entry.ResponseSize > 0 {
		attrs = append(attrs, "response_bytes", entry.ResponseSize)
	}
	if entry.UserAgent != "" {
		attrs = append(attrs, "user_agent", entry.UserAgent)
	}

	// Choose log level based on status code
	if entry.StatusCode >= 500 {
		logger.Error("request completed", attrs...)
	} else if entry.StatusCode >= 400 {
		logger.Warn("request completed", attrs...)
	} else {
		logger.Info("request completed", attrs...)
	}
}

// LogHTTPRequest is a helper that extracts request info and logs it
func LogHTTPRequest(r *http.Request, status int, size int64, duration time.Duration) {
	entry := RequestLogEntry{
		Method:       r.Method,
		Path:         r.URL.Path,
		RemoteAddr:   r.RemoteAddr,
		UserAgent:    r.UserAgent(),
		StatusCode:   status,
		ResponseSize: size,
		Duration:     duration,
	}

	LogRequest(r.Context(), entry)
}

// =============================================================================
// Error Logging
// =============================================================================

// LogError logs an error with stack trace info
func LogError(ctx context.Context, err error, msg string, args ...any) {
	logger := FromContext(ctx)

	// Get caller info
	_, file, line, ok := runtime.Caller(1)
	if ok {
		args = append(args, "source", slog.GroupValue(
			slog.String("file", file),
			slog.Int("line", line),
		))
	}

	args = append(args, "error", err.Error())
	logger.Error(msg, args...)
}

// LogPanic logs a panic with recovery info
func LogPanic(ctx context.Context, recovered interface{}, stack []byte) {
	logger := FromContext(ctx)
	logger.Error("panic recovered",
		"panic", recovered,
		"stack", string(stack),
	)
}

// =============================================================================
// Database Query Logging
// =============================================================================

// LogQuery logs a database query for debugging
func LogQuery(ctx context.Context, query string, duration time.Duration, err error) {
	logger := FromContext(ctx)

	attrs := []any{
		"query", truncateString(query, 200),
		"duration_ms", duration.Milliseconds(),
	}

	if err != nil {
		attrs = append(attrs, "error", err.Error())
		logger.Error("database query failed", attrs...)
	} else {
		logger.Debug("database query executed", attrs...)
	}
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
