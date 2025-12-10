// File: postgres.go
// Purpose: Database connection initialization and query aggregation (SQLc integration)
// Pattern: database-lifecycle
// Dependencies: pgxpool, sqlcgen.Queries
// Frequency: critical
// Compliance: Check docs/adr/ for pattern rationale

package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jcom-dev/zmanim/internal/config"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// DB wraps the database connection pool and SQLc queries
type DB struct {
	Pool    *pgxpool.Pool
	Queries *sqlcgen.Queries
}

// New creates a new database connection pool
func New(cfg *config.Config) (*DB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(cfg.Database.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Configure connection pool
	poolConfig.MaxConns = 25
	poolConfig.MinConns = 5
	poolConfig.MaxConnLifetime = time.Hour
	poolConfig.MaxConnIdleTime = 30 * time.Minute
	poolConfig.HealthCheckPeriod = time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	// Test the connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Initialize SQLc queries
	queries := sqlcgen.New(pool)

	return &DB{Pool: pool, Queries: queries}, nil
}

// Close closes the database connection pool
func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}

// Health checks the database connection health
func (db *DB) Health(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	return db.Pool.Ping(ctx)
}
