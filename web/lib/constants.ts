export const DEFAULT_LOCATION = {
  name: 'Jerusalem',
  latitude: 31.7683,
  longitude: 35.2137,
  timeZone: 'Asia/Jerusalem',
  elevation: 754, // meters above sea level
};

export const TIMEZONE_MAPPINGS: Record<string, string> = {
  'America/New_York': 'US/Eastern',
  'America/Los_Angeles': 'US/Pacific',
  'America/Chicago': 'US/Central',
  'America/Denver': 'US/Mountain',
  'Asia/Jerusalem': 'Israel',
  'Europe/London': 'Europe/London',
  'Europe/Paris': 'Europe/Paris',
};

// Alos Hashachar Calculator specific UI text (used by ZmanimDisplay.tsx)
export const UI_TEXT = {
  calculating: 'Calculating...',
};

// Alos Hashachar Calculator specific constants (used by MethodCard.tsx)
// NOTE: These are different from zmanim time categories - these are calculation method types
export const CATEGORY_COLORS = {
  fixed: {
    bg: '#007AFF',
    text: 'text-[#007AFF]',
    border: 'border-[#007AFF]',
    accent: 'bg-blue-50',
  },
  zmaniyos: {
    bg: '#5856D6',
    text: 'text-[#5856D6]',
    border: 'border-[#5856D6]',
    accent: 'bg-indigo-50',
  },
  angle: {
    bg: '#FF2D55',
    text: 'text-[#FF2D55]',
    border: 'border-[#FF2D55]',
    accent: 'bg-rose-50',
  },
};

// NOTE: Zmanim time/event categories are now database-driven via useTimeCategories/useEventCategories hooks
