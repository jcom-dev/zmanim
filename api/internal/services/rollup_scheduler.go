package services

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// RollupScheduler manages automated daily calculation stats rollup
// with hybrid execution: scheduled hourly runs + on-demand debounced triggers
type RollupScheduler struct {
	queries          *sqlcgen.Queries
	interval         time.Duration
	lastRun          time.Time
	running          bool
	mu               sync.RWMutex
	debounceTimer    *time.Timer
	debounceDuration time.Duration
	stopChan         chan struct{}
	wg               sync.WaitGroup
}

// NewRollupScheduler creates a new rollup scheduler
func NewRollupScheduler(queries *sqlcgen.Queries, intervalHours int) *RollupScheduler {
	return &RollupScheduler{
		queries:          queries,
		interval:         time.Duration(intervalHours) * time.Hour,
		debounceDuration: 5 * time.Second,
		stopChan:         make(chan struct{}),
	}
}

// Start begins the background rollup scheduler
// Runs immediately on startup, then at configured intervals
func (s *RollupScheduler) Start(ctx context.Context) {
	s.wg.Add(1)
	go s.worker(ctx)

	slog.Info("rollup scheduler started",
		"interval_hours", s.interval.Hours(),
		"debounce_seconds", s.debounceDuration.Seconds())
}

// worker is the background goroutine that runs scheduled rollups
func (s *RollupScheduler) worker(ctx context.Context) {
	defer s.wg.Done()

	// Run immediately on startup to process any pending logs
	s.runRollup(ctx)

	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("rollup scheduler shutting down")
			return
		case <-s.stopChan:
			slog.Info("rollup scheduler stopping")
			return
		case <-ticker.C:
			s.runRollup(ctx)
		}
	}
}

// TriggerDebounced triggers a rollup with debouncing
// Multiple rapid calls within 5 seconds result in a single rollup
// Called after calculation batch flush to aggregate near-real-time stats
func (s *RollupScheduler) TriggerDebounced() {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Cancel existing timer if present
	if s.debounceTimer != nil {
		s.debounceTimer.Stop()
	}

	// Create new timer that will fire after debounce duration
	s.debounceTimer = time.AfterFunc(s.debounceDuration, func() {
		ctx := context.Background()
		s.runRollup(ctx)
		slog.Debug("debounced rollup completed")
	})

	slog.Debug("debounced rollup scheduled", "delay_seconds", s.debounceDuration.Seconds())
}

// TriggerImmediate triggers a rollup immediately (used by test endpoint)
// Returns error if rollup fails
func (s *RollupScheduler) TriggerImmediate(ctx context.Context) error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		slog.Warn("rollup already running, skipping immediate trigger")
		return nil
	}
	s.mu.Unlock()

	return s.runRollupWithError(ctx)
}

// runRollup executes the rollup and logs errors (fire-and-forget)
func (s *RollupScheduler) runRollup(ctx context.Context) {
	_ = s.runRollupWithError(ctx)
}

// runRollupWithError executes the actual rollup logic with error return
func (s *RollupScheduler) runRollupWithError(ctx context.Context) error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		slog.Debug("rollup already in progress, skipping")
		return nil
	}
	s.running = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.running = false
		s.lastRun = time.Now()
		s.mu.Unlock()
	}()

	start := time.Now()
	slog.Info("starting calculation stats rollup")

	// Calculate the date to rollup (yesterday and today to catch late arrivals)
	yesterday := time.Now().AddDate(0, 0, -1)
	yesterdayDate := pgtype.Date{
		Time:  yesterday,
		Valid: true,
	}

	// Rollup yesterday's data
	err := s.queries.RollupCalculationStatsDaily(ctx, yesterdayDate)
	if err != nil {
		slog.Error("rollup failed for yesterday",
			"error", err,
			"date", yesterday.Format("2006-01-02"),
			"duration_ms", time.Since(start).Milliseconds())
		return err
	}

	// Rollup today's data (for near-real-time stats)
	today := time.Now()
	todayDate := pgtype.Date{
		Time:  today,
		Valid: true,
	}
	err = s.queries.RollupCalculationStatsDaily(ctx, todayDate)
	if err != nil {
		slog.Error("rollup failed for today",
			"error", err,
			"date", today.Format("2006-01-02"),
			"duration_ms", time.Since(start).Milliseconds())
		return err
	}

	duration := time.Since(start)
	slog.Info("rollup completed successfully",
		"duration_ms", duration.Milliseconds(),
		"dates_processed", 2)

	return nil
}

// GetStatus returns the current rollup scheduler status
func (s *RollupScheduler) GetStatus() (lastRun time.Time, running bool, healthy bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	healthy = true
	// Consider unhealthy if no rollup in last 2 intervals
	if !s.lastRun.IsZero() && time.Since(s.lastRun) > s.interval*2 {
		healthy = false
	}

	return s.lastRun, s.running, healthy
}

// Stop gracefully shuts down the scheduler
// Waits for any in-progress rollup to complete
func (s *RollupScheduler) Stop() {
	slog.Info("stopping rollup scheduler...")

	// Signal worker to stop
	close(s.stopChan)

	// Wait for worker to finish
	s.wg.Wait()

	// Cancel any pending debounced timer
	s.mu.Lock()
	if s.debounceTimer != nil {
		s.debounceTimer.Stop()
	}
	s.mu.Unlock()

	slog.Info("rollup scheduler stopped")
}
