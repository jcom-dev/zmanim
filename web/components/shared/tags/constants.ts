// Tag System Constants

export type TagType = 'behavior' | 'event' | 'jewish_day' | 'timing' | 'shita' | 'calculation' | 'category';

// Order in which tag types appear in the UI
export const TAG_TYPE_ORDER: TagType[] = [
  'behavior',
  'event',
  'jewish_day',
  'timing',
  'shita',
  'calculation',
  'category',
];

// Human-readable labels for tag types
export const TAG_TYPE_LABELS: Record<TagType, string> = {
  behavior: 'Behavior',
  event: 'Events',
  jewish_day: 'Jewish Days',
  timing: 'Timing',
  shita: 'Shita',
  calculation: 'Calculation',
  category: 'Category',
};

// Hebrew labels for tag types
export const TAG_TYPE_LABELS_HEBREW: Record<TagType, string> = {
  behavior: 'התנהגות',
  event: 'אירוע',
  jewish_day: 'יום יהודי',
  timing: 'זמן',
  shita: 'שיטה',
  calculation: 'חישוב',
  category: 'קטגוריה',
};

// Colors for tag types (used for tag badges)
export const TAG_TYPE_COLORS: Record<TagType, string> = {
  behavior: 'hsl(142 76% 36%)',      // Green - actions
  event: 'hsl(221 83% 53%)',         // Blue - occasions
  jewish_day: 'hsl(262 83% 58%)',    // Purple - calendar
  timing: 'hsl(24 95% 53%)',         // Orange - when
  shita: 'hsl(173 80% 40%)',         // Teal - methodology
  calculation: 'hsl(330 81% 60%)',   // Pink - how
  category: 'hsl(47 96% 53%)',       // Gold - what
};

// Tailwind classes for tag type badges
export const TAG_TYPE_BADGE_CLASSES: Record<TagType, string> = {
  behavior: 'bg-green-500/10 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-700',
  event: 'bg-blue-500/10 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-700',
  jewish_day: 'bg-violet-500/10 text-violet-700 border-violet-300 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-700',
  timing: 'bg-orange-500/10 text-orange-700 border-orange-300 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-700',
  shita: 'bg-cyan-500/10 text-cyan-700 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-700',
  calculation: 'bg-pink-500/10 text-pink-700 border-pink-300 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-700',
  category: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-700',
};

// Jewish Day Tags grouped for better UX
// Note: No "erev" tags - use day_before() DSL function for erev-specific times
export const JEWISH_DAY_GROUPS = {
  'Yamim Tovim': [
    'rosh_hashanah',
    'yom_kippur',
    'sukkos',
    'shemini_atzeres',
    'simchas_torah',
    'pesach',
    'shavuos',
  ],
  'Sukkos Cycle': [
    'hoshanah_rabbah',
    'chol_hamoed_sukkos',
  ],
  'Pesach Cycle': [
    'chol_hamoed_pesach',
  ],
  'Fasts': [
    'tzom_gedaliah',
    'taanis_esther',
    'asarah_bteves',
    'shiva_asar_btamuz',
    'tisha_bav',
  ],
  'Other Holidays': [
    'chanukah',
    'purim',
    'shushan_purim',
    'rosh_chodesh',
    'tu_bshvat',
  ],
  'Periods': [
    'omer',
    'selichos',
    'aseres_yemei_teshuva',
    'three_weeks',
    'nine_days',
  ],
  'Diaspora': [
    'yom_tov_sheni',
  ],
} as const;

// Tag interface matching API response
export interface Tag {
  id: number; // Changed from string to number to match backend int32
  tag_key: string;
  name: string;
  display_name_hebrew: string;
  display_name_english: string;
  tag_type: TagType;
  description?: string;
  color?: string;
  sort_order: number;
}

// Tag type metadata for the type filter dropdown
export interface TagTypeInfo {
  key: TagType;
  label: string;
  labelHebrew: string;
  color: string;
  badgeClass: string;
}

export function getTagTypeInfo(type: TagType): TagTypeInfo {
  return {
    key: type,
    label: TAG_TYPE_LABELS[type],
    labelHebrew: TAG_TYPE_LABELS_HEBREW[type],
    color: TAG_TYPE_COLORS[type],
    badgeClass: TAG_TYPE_BADGE_CLASSES[type],
  };
}
