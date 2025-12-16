package services

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// CalculationSource represents the source of a calculation request
type CalculationSource int16

const (
	SourceWeb      CalculationSource = 1 // Web UI
	SourceAPI      CalculationSource = 2 // Authenticated API
	SourceExternal CalculationSource = 3 // External API (M2M)
)

// CalculationLogEntry represents a single calculation log entry
type CalculationLogEntry struct {
	PublisherID    int32
	LocalityID     int64
	DateCalculated time.Time
	CacheHit       bool
	ResponseTimeMs int16
	ZmanCount      int16
	Source         CalculationSource
}

// CalculationLogService handles asynchronous logging of zmanim calculations
// Uses buffered channel + worker pattern for zero-latency impact on API responses
type CalculationLogService struct {
	db            *pgxpool.Pool
	buffer        chan CalculationLogEntry
	batchSize     int
	flushInterval time.Duration
	stopChan      chan struct{}
	wg            sync.WaitGroup
}

// NewCalculationLogService creates a new calculation logging service
// Starts a background worker that batches inserts for performance
func NewCalculationLogService(db *pgxpool.Pool) *CalculationLogService {
	s := &CalculationLogService{
		db:            db,
		buffer:        make(chan CalculationLogEntry, 10000), // Large buffer for high volume
		batchSize:     100,                                   // Flush every 100 records
		flushInterval: time.Second,                           // OR every 1 second
		stopChan:      make(chan struct{}),
	}

	// Start the background worker
	s.wg.Add(1)
	go s.worker()

	slog.Info("CalculationLogService started", "buffer_size", 10000, "batch_size", 100, "flush_interval", "1s")

	return s
}

// Log adds a single calculation entry to the buffer
// Non-blocking - never delays the API response
func (s *CalculationLogService) Log(entry CalculationLogEntry) {
	select {
	case s.buffer <- entry:
		// Successfully added to buffer
	default:
		// Buffer full - log warning but don't block
		// This is intentional - we drop entries rather than blocking API responses
		slog.Warn("calculation log buffer full, dropping entry",
			"publisher_id", entry.PublisherID,
			"locality_id", entry.LocalityID)
	}
}

// LogBatch adds multiple calculation entries to the buffer
// Used for bulk API calls to efficiently log all calculations
func (s *CalculationLogService) LogBatch(entries []CalculationLogEntry) {
	for _, entry := range entries {
		s.Log(entry)
	}
}

// worker is the background goroutine that processes the buffer
// Batches entries and uses PostgreSQL COPY protocol for maximum performance
func (s *CalculationLogService) worker() {
	defer s.wg.Done()

	batch := make([]CalculationLogEntry, 0, s.batchSize)
	ticker := time.NewTicker(s.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case entry := <-s.buffer:
			batch = append(batch, entry)
			if len(batch) >= s.batchSize {
				s.flush(batch)
				batch = batch[:0] // Reset batch, keep capacity
			}

		case <-ticker.C:
			if len(batch) > 0 {
				s.flush(batch)
				batch = batch[:0]
			}

		case <-s.stopChan:
			// Drain remaining entries from buffer
			for len(s.buffer) > 0 {
				batch = append(batch, <-s.buffer)
			}
			if len(batch) > 0 {
				s.flush(batch)
			}
			return
		}
	}
}

// flush inserts a batch of entries using PostgreSQL COPY protocol
// COPY is 5-10x faster than individual INSERT statements
func (s *CalculationLogService) flush(batch []CalculationLogEntry) {
	if len(batch) == 0 {
		return
	}

	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Use COPY protocol for maximum insert performance
	_, err := s.db.CopyFrom(
		ctx,
		pgx.Identifier{"calculation_logs"},
		[]string{"publisher_id", "locality_id", "date_calculated", "cache_hit",
			"response_time_ms", "zman_count", "source", "created_at"},
		pgx.CopyFromSlice(len(batch), func(i int) ([]any, error) {
			e := batch[i]
			return []any{
				e.PublisherID,
				e.LocalityID,
				e.DateCalculated,
				e.CacheHit,
				e.ResponseTimeMs,
				e.ZmanCount,
				int16(e.Source),
				time.Now(),
			}, nil
		}),
	)

	if err != nil {
		slog.Error("failed to flush calculation logs",
			"error", err,
			"count", len(batch),
			"duration_ms", time.Since(start).Milliseconds())
		return
	}

	slog.Debug("flushed calculation logs",
		"count", len(batch),
		"duration_ms", time.Since(start).Milliseconds())
}

// Close gracefully shuts down the service
// Flushes all pending entries before returning
func (s *CalculationLogService) Close() error {
	slog.Info("Shutting down CalculationLogService...")

	// Signal worker to stop
	close(s.stopChan)

	// Wait for worker to finish draining buffer
	s.wg.Wait()

	slog.Info("CalculationLogService shutdown complete")
	return nil
}
