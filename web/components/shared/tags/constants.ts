// Tag System Constants

export type TagType = 'event' | 'timing' | 'shita' | 'category';

// Order in which tag types appear in the UI
export const TAG_TYPE_ORDER: TagType[] = [
  'event',
  'timing',
  'shita',
  'category',
];

// Human-readable labels for tag types
export const TAG_TYPE_LABELS: Record<TagType, string> = {
  event: 'Events',
  timing: 'Timing',
  shita: 'Shita',
  category: 'Category',
};

// Hebrew labels for tag types
export const TAG_TYPE_LABELS_HEBREW: Record<TagType, string> = {
  event: 'אירוע',
  timing: 'זמן',
  shita: 'שיטה',
  category: 'קטגוריה',
};

// Colors for tag types (used for tag badges)
export const TAG_TYPE_COLORS: Record<TagType, string> = {
  event: 'hsl(221 83% 53%)',         // Blue - occasions/holidays
  timing: 'hsl(24 95% 53%)',         // Orange - when
  shita: 'hsl(173 80% 40%)',         // Teal - methodology
  category: 'hsl(47 96% 53%)',       // Gold - what
};

// Tailwind classes for tag type badges
export const TAG_TYPE_BADGE_CLASSES: Record<TagType, string> = {
  event: 'bg-blue-500/10 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-700',
  timing: 'bg-orange-500/10 text-orange-700 border-orange-300 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-700',
  shita: 'bg-cyan-500/10 text-cyan-700 border-cyan-300 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-700',
  category: 'bg-amber-500/10 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-700',
};

// Event Tags grouped for better UX (includes former jewish_day tags)
// Note: No "erev" tags - use day_before() DSL function for erev-specific times
export const EVENT_GROUPS = {
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
