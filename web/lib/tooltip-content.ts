/**
 * Centralized tooltip content for consistent messaging across the application
 * Organized by category for easy maintenance and updates
 */

// =============================================================================
// STATUS TOOLTIPS
// =============================================================================

export const STATUS_TOOLTIPS = {
  // Publisher statuses
  verified:
    'This publisher has been verified by our team. Their identity and halachic authority have been confirmed.',
  pending:
    'Awaiting admin verification. This typically takes 1-3 business days.',
  pending_verification:
    'Publisher has completed their profile and is awaiting admin review.',
  suspended:
    'This publisher has been temporarily disabled. Their zmanim are not visible to users.',
  draft:
    'This content is in draft mode and not visible to users. Publish to make it available.',
  published:
    'This content is live and visible to users in applicable coverage areas.',
  active: 'Currently active and functioning normally.',
  inactive: 'Temporarily disabled but preserved for later use.',
} as const;

// =============================================================================
// COVERAGE TOOLTIPS
// =============================================================================

export const COVERAGE_TOOLTIPS = {
  level: {
    continent:
      'Your zmanim apply to all localities in selected continents. Broadest coverage level.',
    country: 'Your zmanim apply to all localities in selected countries.',
    region:
      'Your zmanim apply to all localities in selected states, provinces, or regions.',
    locality:
      'Your zmanim apply only to specifically selected localities. Most precise coverage.',
  },
  priority:
    'When multiple publishers cover an area, higher priority publishers appear first in search results. Default is 0.',
  active_toggle:
    'Inactive coverage areas are hidden from users but preserved for later reactivation.',
  matching:
    'Publishers can cover entire continents, countries, regions, or specific localities. More specific coverage typically means more localized accuracy.',
} as const;

// =============================================================================
// ALGORITHM & DSL TOOLTIPS
// =============================================================================

export const ALGORITHM_TOOLTIPS = {
  // Calculation methods
  gra: 'Gra of Vilna calculation method: Uses actual sunrise to sunset for determining day length.',
  mga: 'Magen Abraham calculation method: Uses Alos (dawn) to Tzeis (nightfall) for day length, resulting in longer "halachic hours."',
  ateret_torah:
    'Ateret Torah calculation method: Sephardic approach using sunrise to tzais 40 minutes (or other tzais variant) for determining day length.',

  // Solar angles
  solar_angle_16_1:
    'Solar angle of 16.1 degrees below the horizon. Commonly used for Alos (dawn) and Tzeis (nightfall) calculations.',
  solar_angle_8_5:
    'Solar angle of 8.5 degrees below the horizon. Often used for an earlier Tzeis.',
  solar_angle_general:
    'The angle of the sun below the horizon. Different authorities use different angles for dawn and nightfall.',

  // Calculation types
  fixed_zman: 'A specific time that does not change based on location or date (e.g., always 6:00 AM).',
  solar_angle: 'Time calculated based on when the sun reaches a specific angle below the horizon.',
  fixed_offset: 'A time calculated as minutes before or after another zman (e.g., 18 minutes before sunset).',
  proportional_hours:
    'Time calculated as a fraction of the halachic day, which divides daylight into 12 equal hours.',
  proportional_minutes:
    'Time calculated using proportional minutes: offset = (minutes / 720) × day_length. Used for zmanim like Alos 72 minutes, where the offset scales with day length.',

  // Functions
  first_valid:
    'Returns the first successfully calculated value from a list of options. Used for fallback logic when primary calculations may fail at extreme latitudes.',
  earlier_of:
    'Returns whichever time comes first chronologically. Useful for taking the earlier of two calculated times.',
  later_of:
    'Returns whichever time comes last chronologically. Useful for taking the later of two calculated times.',

  // Bases (calculation day boundaries)
  mga_60: 'MGA 60-minute variant: Day runs from 60 minutes before sunrise to 60 minutes after sunset.',
  mga_72: 'MGA 72-minute variant: Day runs from 72 minutes before sunrise to 72 minutes after sunset. Standard MGA method.',
  mga_96: 'MGA 96-minute variant: Day runs from 96 minutes before sunrise to 96 minutes after sunset. More stringent.',
  mga_72_zmanis: 'MGA 72 zmaniyos: Uses 1/10th of day length before sunrise and after sunset. Adjusts seasonally.',
  mga_90_zmanis: 'MGA 90 zmaniyos: Uses 1/8th of day length before sunrise and after sunset. Adjusts seasonally.',
  mga_96_zmanis: 'MGA 96 zmaniyos: Uses 1/7.5th of day length before sunrise and after sunset. Adjusts seasonally.',
  mga_16_1: 'MGA 16.1° solar angle variant: Day runs from 16.1° below horizon to 16.1° after. Equivalent to 72 minutes at Jerusalem equinox.',
  mga_18: 'MGA 18° solar angle variant: Day runs from 18° below horizon to 18° after. Astronomical twilight.',
  mga_19_8: 'MGA 19.8° solar angle variant: Day runs from 19.8° below horizon to 19.8° after. Equivalent to 90 minutes at Jerusalem equinox.',
  mga_26: 'MGA 26° solar angle variant: Day runs from 26° below horizon to 26° after. Equivalent to 120 minutes at Jerusalem equinox.',
  baal_hatanya: 'Baal HaTanya (Chabad) method: Uses 1.583° below horizon for true sunrise (netz amiti) and true sunset (shkiah amiti). Based on Shulchan Aruch HaRav.',

  // Directions
  before_noon: 'Morning direction: Sun is ascending toward solar noon. Used with solar angle calculations.',
  after_noon: 'Afternoon direction: Sun is descending from solar noon. Used with solar angle calculations.',

  // Primitives
  visible_sunrise: 'When you first see the sun appear above the horizon. Accounts for atmospheric refraction of light.',
  visible_sunset: 'When the sun completely disappears below the horizon. Accounts for atmospheric refraction of light.',

  // Editor modes
  guided_builder:
    'Visual formula builder for common calculation patterns. Best for standard calculations without complex logic.',
  advanced_dsl:
    'Direct formula editing with full DSL syntax access. Required for complex conditional logic or custom calculations.',

  // Fields
  hebrew_name:
    'Required. Must contain Hebrew characters (א-ת). This name is displayed to Hebrew-reading users.',
  transliteration:
    'Phonetic pronunciation for non-Hebrew speakers. Example: "Alos HaShachar" or "Shkiah".',
  publisher_comment:
    'Optional note displayed to end users. Use for halachic context, source references, or special instructions.',
  ai_explanation:
    'Generate a plain-language explanation of this zman using AI. Helps users understand the calculation.',

  // Categories
  everyday_tab: 'Regular daily zmanim like Alos, Sunrise, Sunset, Mincha times, etc.',
  events_tab:
    'Special occasion zmanim like Shabbos candle lighting, Havdalah, and holiday-specific times.',
  core_zman:
    'Essential zmanim that are shown by default. These are the fundamental Zmanim.',
  optional_zman:
    'Secondary zmanim that provide additional information but are not essential.',
} as const;

// =============================================================================
// FORM FIELD TOOLTIPS
// =============================================================================

export const FORM_TOOLTIPS = {
  // Publisher profile
  publisher_name:
    'The name of your synagogue, organization, or religious authority. This is displayed publicly to users.',
  bio: 'A brief description of your halachic approach, credentials, and authority. Help users understand your methodology.',
  logo: 'Recommended: Square image, minimum 200x200 pixels. PNG or JPG format.',
  website: 'Your official website or organization page. Will be displayed as a link.',

  // Algorithm fields
  formula_dsl:
    'The DSL (Domain-Specific Language) formula that calculates this zman. Uses primitives like SUNRISE, SUNSET, and functions like SolarAngle().',
  default_formula:
    'The default calculation used when publishers do not specify their own formula.',
  halachic_source:
    'Primary halachic reference for this zman (e.g., "Shulchan Aruch OC 89:1").',
  halachic_notes:
    'Additional context about the zman\'s halachic significance, variations, or disputes.',

  // Registry fields
  time_category:
    'Classification of when this zman occurs during the day: morning, midday, evening, night, or variable.',
  tag_type:
    'Event: special occasions. Timing: daily Zmanim. Behavior: calculation method descriptors.',
  is_core:
    'Core zmanim are essential and shown by default. Toggle off for secondary/optional zmanim.',
  is_hidden:
    'Hidden zmanim are not shown to publishers or users but remain in the system for reference.',
} as const;

// =============================================================================
// ADMIN & METRICS TOOLTIPS
// =============================================================================

export const ADMIN_TOOLTIPS = {
  // Dashboard metrics
  active_publishers:
    'Publishers with verified status whose zmanim are currently visible to users.',
  pending_approval:
    'Publishers who have registered and are awaiting identity and authority verification.',
  suspended_count:
    'Publishers temporarily disabled due to policy violations or at their own request.',
  cache_hit_ratio:
    'Percentage of zmanim requests served from cache vs. calculated fresh. Higher is better for performance.',
  total_calculations:
    'Total number of zmanim calculations performed, including both cached and fresh calculations.',
  calculations_this_month:
    'Number of times users have requested zmanim that included calculations from this publisher.',

  // Actions
  verify_action:
    'Approve this publisher. Their zmanim will become visible to users in their coverage areas.',
  suspend_action:
    'Temporarily disable this publisher. Their zmanim will be hidden from all users.',
  reactivate_action:
    'Restore this publisher to active status. Their zmanim will become visible again.',
  impersonate_action:
    'View the platform as this publisher sees it. Useful for debugging and support.',
} as const;

// =============================================================================
// USER-FACING TOOLTIPS
// =============================================================================

export const USER_TOOLTIPS = {
  // Location
  use_my_location:
    'Requires browser location permission. Your location data is only used for finding nearby zmanim and is not stored.',
  elevation:
    'Elevation affects sunrise and sunset times. Higher elevations see the sun earlier in the morning and later in the evening.',
  city_search:
    'Start typing to search. We have over 160,000 localities worldwide in our database.',

  // Time display
  time_format:
    'All times are shown in 12-hour format (AM/PM) and are calculated for the specific date and location selected.',
  zman_calculation:
    'This time is calculated based on the publisher\'s formula and may differ from other authorities.',
} as const;

// =============================================================================
// HELPER FUNCTION
// =============================================================================

/**
 * Get a tooltip by category and key
 * @example getTooltip('status', 'verified')
 */
export function getTooltip(
  category: 'status' | 'coverage' | 'algorithm' | 'form' | 'admin' | 'user',
  key: string
): string {
  const categories = {
    status: STATUS_TOOLTIPS,
    coverage: COVERAGE_TOOLTIPS,
    algorithm: ALGORITHM_TOOLTIPS,
    form: FORM_TOOLTIPS,
    admin: ADMIN_TOOLTIPS,
    user: USER_TOOLTIPS,
  };

  const categoryObj = categories[category];
  if (!categoryObj) return '';

  // Handle nested objects (like coverage.level)
  if (typeof categoryObj === 'object') {
    const value = (categoryObj as Record<string, unknown>)[key];
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      // Return the whole nested object for further access
      return '';
    }
  }

  return '';
}
