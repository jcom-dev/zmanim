package handlers

import (
	"context"

	"github.com/jcom-dev/zmanim/internal/calendar"
	"github.com/jcom-dev/zmanim/internal/db/sqlcgen"
)

// sqlcAdapter wraps sqlc Queries to implement calendar.DBAdapter
// This adapter converts between sqlcgen types and calendar package types
type sqlcAdapter struct {
	queries *sqlcgen.Queries
}

// MatchHebcalEvent implements calendar.DBAdapter interface
func (a *sqlcAdapter) MatchHebcalEvent(ctx context.Context, params calendar.MatchHebcalEventParams) ([]calendar.MatchHebcalEventRow, error) {
	// Convert calendar params to sqlcgen params
	sqlcParams := sqlcgen.MatchHebcalEventParams{
		HebcalTitle:    params.HebcalTitle,
		HebcalCategory: params.HebcalCategory,
	}

	// Call sqlcgen query
	sqlcRows, err := a.queries.MatchHebcalEvent(ctx, sqlcParams)
	if err != nil {
		return nil, err
	}

	// Convert sqlcgen rows to calendar rows
	calRows := make([]calendar.MatchHebcalEventRow, len(sqlcRows))
	for i, sqlcRow := range sqlcRows {
		calRows[i] = calendar.MatchHebcalEventRow{
			ID:                          sqlcRow.ID,
			TagKey:                      sqlcRow.TagKey,
			DisplayNameHebrew:           sqlcRow.DisplayNameHebrew,
			DisplayNameEnglishAshkenazi: sqlcRow.DisplayNameEnglishAshkenazi,
			DisplayNameEnglishSephardi:  sqlcRow.DisplayNameEnglishSephardi,
			TagTypeID:                   sqlcRow.TagTypeID,
			TagType:                     sqlcRow.TagType,
			TagTypeDisplayHebrew:        sqlcRow.TagTypeDisplayHebrew,
			TagTypeDisplayEnglish:       sqlcRow.TagTypeDisplayEnglish,
			Description:                 sqlcRow.Description,
			Color:                       sqlcRow.Color,
			MatchType:                   sqlcRow.MatchType,
		}
	}

	return calRows, nil
}

// NewCalendarDBAdapter creates a calendar.DBAdapter from sqlc Queries
func NewCalendarDBAdapter(queries *sqlcgen.Queries) calendar.DBAdapter {
	return &sqlcAdapter{queries: queries}
}
