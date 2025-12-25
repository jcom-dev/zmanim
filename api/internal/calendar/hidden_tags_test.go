package calendar

import (
	"testing"
)

// TestHiddenTagsBehavior documents the expected behavior of hidden tags
// This is a documentation test showing how hidden tags work in the system
func TestHiddenTagsBehavior(t *testing.T) {
	t.Run("hidden tags should be filtered from user-facing queries", func(t *testing.T) {
		// This test documents that:
		// 1. User-facing SQL queries filter WHERE is_hidden = false
		// 2. Generic tags like 'yom_tov', 'fast_day' are hidden
		// 3. Specific tags like 'rosh_hashanah', 'chanukah' are visible
		// NOTE: Category tags have been removed from the system

		// Expected hidden tags (3 total):
		hiddenTags := []string{
			// Generic category tags
			"yom_tov",
			"fast_day",
			"day_before",
		}

		// Expected visible event tags (examples):
		visibleEventTags := []string{
			"rosh_hashanah",
			"yom_kippur",
			"sukkos",
			"chanukah",
			"pesach",
			"shavuos",
			"purim",
			"tisha_bav",
			"shabbos",
		}

		// Document the expected counts (updated after category tag removal)
		expectedTotalTags := 65
		expectedHiddenTags := 3
		expectedVisibleTags := 62
		expectedVisibleEventTags := 47

		t.Logf("Hidden tags implementation:")
		t.Logf("  Total tags: %d", expectedTotalTags)
		t.Logf("  Hidden tags: %d (%.1f%%)", expectedHiddenTags, float64(expectedHiddenTags)/float64(expectedTotalTags)*100)
		t.Logf("  Visible tags: %d (%.1f%%)", expectedVisibleTags, float64(expectedVisibleTags)/float64(expectedTotalTags)*100)
		t.Logf("  Visible event tags: %d", expectedVisibleEventTags)
		t.Logf("")
		t.Logf("Hidden tags (should NOT appear in UI):")
		for _, tag := range hiddenTags {
			t.Logf("  - %s", tag)
		}
		t.Logf("")
		t.Logf("Visible event tags (SHOULD appear in UI):")
		for _, tag := range visibleEventTags {
			t.Logf("  - %s", tag)
		}
	})

	t.Run("hidden tags should still participate in filtering", func(t *testing.T) {
		// This test documents that:
		// 1. Hidden tags are used internally for event matching
		// 2. Hidden tags participate in filtering logic
		// 3. Hidden tags are just invisible in the UI, not disabled

		// Example: When processing a date that is Yom Kippur:
		// - The 'yom_tov' tag is matched (hidden, but used internally)
		// - The 'yom_kippur' tag is matched (visible, shown to users)
		// - Both tags trigger appropriate filtering logic
		// - Only 'yom_kippur' appears in the UI

		t.Log("Hidden tags are used for:")
		t.Log("  1. Event detection and matching")
		t.Log("  2. Filtering zmanim by context")
		t.Log("  3. Categorization and grouping")
		t.Log("  4. Internal business logic")
		t.Log("")
		t.Log("Hidden tags are NOT shown in:")
		t.Log("  1. Tag selectors")
		t.Log("  2. Tag chips")
		t.Log("  3. Tag filters")
		t.Log("  4. Public API responses (unless admin)")
	})

	t.Run("admin queries can access hidden tags", func(t *testing.T) {
		// This test documents that:
		// 1. Admin queries explicitly return is_hidden field
		// 2. Admin UI can show/edit all tags including hidden ones
		// 3. GetAllTagsAdmin query includes WHERE clause parameter for filtering

		t.Log("Admin access to hidden tags:")
		t.Log("  - GetAllTagsAdmin(includeHidden=true) returns all 74 tags")
		t.Log("  - GetAllTagsAdmin(includeHidden=false) returns 62 visible tags")
		t.Log("  - is_hidden field is included in admin responses")
		t.Log("  - Future admin UI can toggle tag visibility")
	})

	t.Run("db adapter converts interface{} to bool correctly", func(t *testing.T) {
		// This test documents the type conversion in db_adapter.go
		// SQLc generates is_multi_day as interface{} from COALESCE(t.total_days > 1, false)
		// DBAdapter converts it to bool for EventMetadata

		// Example GetEventMetadataByKeys result:
		// TagKey: "yom_kippur"
		// YomTovLevel: 1
		// IsMultiDay: false (converted from interface{})
		// DurationDaysIsrael: 1
		// DurationDaysDiaspora: 1
		// FastStartType: "sunset"

		t.Log("DBAdapter type conversions:")
		t.Log("  - IsMultiDay: interface{} -> bool (handles nil safely)")
		t.Log("  - YomTovLevel: int32 (direct mapping)")
		t.Log("  - FastStartType: *string (nullable)")
	})
}

// TestEventMetadataQuerier documents the Querier interface contract
func TestEventMetadataQuerier(t *testing.T) {
	t.Run("querier interface contract", func(t *testing.T) {
		// This test documents the minimal DB interface needed by CalendarService

		// The Querier interface is defined in hebrew.go:
		// type Querier interface {
		//     GetEventMetadataByKeys(ctx context.Context, eventCodes []string) ([]EventMetadata, error)
		// }

		// DBAdapter implements this interface by:
		// 1. Calling sqlcgen.Queries.GetEventMetadataByKeys
		// 2. Converting sqlcgen types to calendar.EventMetadata
		// 3. Handling interface{} to bool conversion for IsMultiDay

		t.Log("Querier interface:")
		t.Log("  - Minimal interface for CalendarService DB access")
		t.Log("  - Implemented by DBAdapter")
		t.Log("  - Enables testability via mocking")
		t.Log("  - Decouples calendar package from sqlcgen")
		t.Log("")
		t.Log("Usage:")
		t.Log("  adapter := NewDBAdapter(queries)")
		t.Log("  service := NewCalendarServiceWithDB(adapter)")
		t.Log("  metadata, err := service.db.GetEventMetadataByKeys(ctx, eventCodes)")
	})
}

// TestHiddenTagsValidation can be extended to perform actual database validation
// For now, use scripts/validate-hidden-tags.sh for comprehensive validation
