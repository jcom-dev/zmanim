// Package geo provides geographic data utilities shared across import tools.
package geo

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SearchIndexDef defines an index to be created on geo_search_index.
type SearchIndexDef struct {
	Name     string // Index name
	SQL      string // CREATE INDEX statement
	Estimate string // Estimated build time (for progress display)
}

// SearchIndexes returns the canonical list of indexes for geo_search_index.
// This is the single source of truth used by both geo-index and seed-geodata.
func SearchIndexes() []SearchIndexDef {
	return []SearchIndexDef{
		{"idx_geo_search_keywords", "CREATE INDEX idx_geo_search_keywords ON geo_search_index USING GIN(keywords)", "1-3 min"},
		{"idx_geo_search_keywords_locality", "CREATE INDEX idx_geo_search_keywords_locality ON geo_search_index USING GIN(keywords) WHERE entity_type = 'locality'", "1-2 min"},
		{"idx_geo_search_trgm", "CREATE INDEX idx_geo_search_trgm ON geo_search_index USING GIN(display_name gin_trgm_ops)", "1-2 min"},
		{"idx_geo_search_pop", "CREATE INDEX idx_geo_search_pop ON geo_search_index(population DESC NULLS LAST)", "~10 sec"},
		{"idx_geo_search_country", "CREATE INDEX idx_geo_search_country ON geo_search_index(country_id)", "~10 sec"},
		{"idx_geo_search_locality_country", "CREATE INDEX idx_geo_search_locality_country ON geo_search_index(country_id) WHERE entity_type = 'locality'", "~10 sec"},
		{"idx_geo_search_inherited_region", "CREATE INDEX idx_geo_search_inherited_region ON geo_search_index(inherited_region_id)", "~10 sec"},
		{"idx_geo_search_ancestor_regions", "CREATE INDEX idx_geo_search_ancestor_regions ON geo_search_index USING GIN(ancestor_region_ids)", "~30 sec"},
		{"idx_geo_search_direct_parent", "CREATE INDEX idx_geo_search_direct_parent ON geo_search_index(direct_parent_type, direct_parent_id)", "~10 sec"},
		{"idx_geo_search_type", "CREATE INDEX idx_geo_search_type ON geo_search_index(entity_type)", "~10 sec"},
		{"idx_geo_search_parent_browse", "CREATE INDEX idx_geo_search_parent_browse ON geo_search_index(direct_parent_type, direct_parent_id, population DESC NULLS LAST)", "~10 sec"},
		{"idx_geo_search_entity", "CREATE INDEX idx_geo_search_entity ON geo_search_index(entity_type, entity_id)", "~10 sec"},
	}
}

// SearchIndexNames returns just the index names (for dropping).
func SearchIndexNames() []string {
	indexes := SearchIndexes()
	names := make([]string, len(indexes))
	for i, idx := range indexes {
		names[i] = idx.Name
	}
	return names
}

// DropSearchIndexes drops all geo_search_index indexes.
func DropSearchIndexes(ctx context.Context, pool *pgxpool.Pool) error {
	for _, name := range SearchIndexNames() {
		_, err := pool.Exec(ctx, fmt.Sprintf("DROP INDEX IF EXISTS %s", name))
		if err != nil {
			slog.Warn("failed to drop index", "index", name, "error", err)
		}
	}
	return nil
}

// CreateSearchIndexes creates all geo_search_index indexes.
// If logger is non-nil, progress is logged.
func CreateSearchIndexes(ctx context.Context, pool *pgxpool.Pool, logger *slog.Logger) error {
	for _, idx := range SearchIndexes() {
		if logger != nil {
			logger.Info("creating index", "name", idx.Name, "estimate", idx.Estimate)
		}
		_, err := pool.Exec(ctx, idx.SQL)
		if err != nil {
			return fmt.Errorf("create index %s: %w", idx.Name, err)
		}
	}
	return nil
}

// AnalyzeSearchIndex runs ANALYZE on geo_search_index for query planner optimization.
func AnalyzeSearchIndex(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, "ANALYZE geo_search_index")
	return err
}
