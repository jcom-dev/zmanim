/**
 * Halachic Terminology Glossary
 * Centralized definitions for Jewish religious terms used throughout the application
 *
 * Each entry includes:
 * - hebrew: The Hebrew name
 * - transliteration: Phonetic spelling for non-Hebrew readers
 * - brief: Short 1-line definition (for tooltips)
 * - detailed: Longer explanation (for documentation/help pages)
 */

export interface HalachicTerm {
  hebrew: string;
  transliteration: string;
  brief: string;
  detailed: string;
  category: 'time' | 'prayer' | 'holiday' | 'concept' | 'authority';
}

export const HALACHIC_GLOSSARY: Record<string, HalachicTerm> = {
  // =============================================================================
  // ZMANIM (TIMES)
  // =============================================================================

  alos_hashachar: {
    hebrew: 'עלות השחר',
    transliteration: 'Alos HaShachar',
    brief: 'Dawn - the first light visible on the eastern horizon before sunrise.',
    detailed:
      'The earliest time for many morning mitzvos. There are various opinions on when exactly this occurs, ranging from 72 minutes before sunrise to when the sun is 16.1° below the horizon.',
    category: 'time',
  },

  misheyakir: {
    hebrew: 'משיכיר',
    transliteration: 'Misheyakir',
    brief: 'When there is enough light to recognize an acquaintance from 4 cubits away.',
    detailed:
      'The earliest time to put on tallis and tefillin. Typically occurs when the sun is about 11° below the horizon, though opinions vary.',
    category: 'time',
  },

  netz_hachama: {
    hebrew: 'נץ החמה',
    transliteration: 'Netz HaChama',
    brief: 'Sunrise - when the upper edge of the sun appears on the horizon.',
    detailed:
      'The ideal time to begin Shacharis (morning prayers). This is calculated for sea level and may need adjustment for elevation and obstructions.',
    category: 'time',
  },

  sof_zman_shema: {
    hebrew: 'סוף זמן קריאת שמע',
    transliteration: 'Sof Zman Shema',
    brief: 'Latest time to recite the morning Shema prayer.',
    detailed:
      'Must be completed by the end of the 3rd halachic hour of the day. The GRA calculates from sunrise, while the MGA calculates from Alos.',
    category: 'time',
  },

  sof_zman_tefillah: {
    hebrew: 'סוף זמן תפילה',
    transliteration: 'Sof Zman Tefillah',
    brief: 'Latest time for the morning Amidah (Shemoneh Esrei) prayer.',
    detailed:
      'Must be completed by the end of the 4th halachic hour. After this time, one may still pray but without the full merit.',
    category: 'time',
  },

  chatzos: {
    hebrew: 'חצות',
    transliteration: 'Chatzos',
    brief: 'Midday - when the sun is at its highest point in the sky.',
    detailed:
      'The exact middle of the day, calculated as halfway between sunrise and sunset (or Alos and Tzeis for some opinions). Important for various halachos.',
    category: 'time',
  },

  mincha_gedolah: {
    hebrew: 'מנחה גדולה',
    transliteration: 'Mincha Gedolah',
    brief: 'Earliest time for the afternoon Mincha prayer.',
    detailed:
      'Begins 30 minutes (in halachic time) after Chatzos. This is the earliest one may pray Mincha, though it is preferable to wait for Mincha Ketanah.',
    category: 'time',
  },

  mincha_ketanah: {
    hebrew: 'מנחה קטנה',
    transliteration: 'Mincha Ketanah',
    brief: 'Preferred start time for afternoon Mincha prayer.',
    detailed:
      'Begins at 9.5 halachic hours into the day. This is the ideal time to begin Mincha according to many authorities.',
    category: 'time',
  },

  plag_hamincha: {
    hebrew: 'פלג המנחה',
    transliteration: 'Plag HaMincha',
    brief: 'Transitional time between afternoon and evening.',
    detailed:
      'Occurs 1.25 halachic hours before sunset. One may accept Shabbos and light candles from this time. Some permit Maariv to be prayed after Plag.',
    category: 'time',
  },

  shkiah: {
    hebrew: 'שקיעה',
    transliteration: 'Shkiah',
    brief: 'Sunset - when the upper edge of the sun disappears below the horizon.',
    detailed:
      'Marks the end of the halachic day for most purposes. Many restrictions (like Shabbos) begin at this time. Also called "Shekia."',
    category: 'time',
  },

  bein_hashmashos: {
    hebrew: 'בין השמשות',
    transliteration: 'Bein HaShmashos',
    brief: 'Twilight - the uncertain period between day and night.',
    detailed:
      'The time between sunset and nightfall when it is uncertain whether it is still day or already night. We treat this period stringently for both.',
    category: 'time',
  },

  tzeis_hakochavim: {
    hebrew: 'צאת הכוכבים',
    transliteration: 'Tzeis HaKochavim',
    brief: 'Nightfall - when three medium stars are visible in the sky.',
    detailed:
      'The definitive start of night. Shabbos and holidays end at this time. Various opinions calculate this from 13.5 to 72 minutes after sunset, or by solar angle.',
    category: 'time',
  },

  chatzos_layla: {
    hebrew: 'חצות לילה',
    transliteration: 'Chatzos Layla',
    brief: 'Midnight - the halachic middle of the night.',
    detailed:
      'Calculated as halfway between sunset and sunrise (or Tzeis and Alos). Important for certain prayers and the latest time for the Pesach Seder.',
    category: 'time',
  },

  // =============================================================================
  // SHABBOS & HOLIDAY TIMES
  // =============================================================================

  candle_lighting: {
    hebrew: 'הדלקת נרות',
    transliteration: 'Hadlakas Neiros',
    brief: 'Time to light Shabbos or holiday candles, typically 18 minutes before sunset.',
    detailed:
      'The custom is to light candles 18 minutes before sunset (some communities use 20, 30, or 40 minutes). This adds to Shabbos and ensures candles are lit before the prohibition begins.',
    category: 'holiday',
  },

  havdalah: {
    hebrew: 'הבדלה',
    transliteration: 'Havdalah',
    brief: 'End of Shabbos ceremony, performed after nightfall.',
    detailed:
      'The ceremony marking the end of Shabbos, including blessings over wine, spices, and fire. Performed after Tzeis HaKochavim when Shabbos ends.',
    category: 'holiday',
  },

  tosefes_shabbos: {
    hebrew: 'תוספת שבת',
    transliteration: 'Tosefes Shabbos',
    brief: 'Adding time to Shabbos before it begins and after it ends.',
    detailed:
      'The mitzvah to extend Shabbos by accepting it early (before sunset) and ending it late (after the minimum nightfall time).',
    category: 'concept',
  },

  // =============================================================================
  // CALCULATION METHODS & AUTHORITIES
  // =============================================================================

  gra: {
    hebrew: 'הגר"א',
    transliteration: 'HaGra',
    brief: 'The Vilna Gaon - calculates the day from sunrise to sunset.',
    detailed:
      'Rabbi Eliyahu of Vilna (1720-1797). His method divides the time from actual sunrise to actual sunset into 12 equal hours. Widely followed in Israel and by many communities.',
    category: 'authority',
  },

  mga: {
    hebrew: 'מג"א',
    transliteration: "Magen Avraham",
    brief: 'Magen Avraham - calculates the day from dawn (Alos) to nightfall (Tzeis).',
    detailed:
      'Rabbi Avraham Gombiner (1635-1682). His method uses a longer day, from 72 minutes before sunrise to 72 minutes after sunset, resulting in longer halachic hours.',
    category: 'authority',
  },

  rabbeinu_tam: {
    hebrew: 'רבינו תם',
    transliteration: 'Rabbeinu Tam',
    brief: 'Holds that nightfall is 72 minutes after sunset.',
    detailed:
      'Rabbi Yaakov ben Meir (1100-1171). His opinion that night begins much later than the visible stars is followed by many for ending Shabbos and fasts.',
    category: 'authority',
  },

  // =============================================================================
  // CONCEPTS
  // =============================================================================

  shaos_zmanios: {
    hebrew: 'שעות זמניות',
    transliteration: 'Shaos Zmanios',
    brief: 'Proportional/halachic hours - dividing daylight into 12 equal parts.',
    detailed:
      'Unlike fixed 60-minute hours, halachic hours vary by season. In summer, each hour is longer; in winter, shorter. Used for calculating Zmanim and other halachos.',
    category: 'concept',
  },

  zman: {
    hebrew: 'זמן',
    transliteration: 'Zman',
    brief: 'A specific halachic time for prayers or observances.',
    detailed:
      'Plural: Zmanim. These are the calculated times that govern Jewish religious practice, including Zmanim, candle lighting, and the start/end of Shabbos.',
    category: 'concept',
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a brief tooltip for a halachic term
 */
export function getHalachicTooltip(key: string): string {
  const term = HALACHIC_GLOSSARY[key];
  return term?.brief || '';
}

/**
 * Get the full term object
 */
export function getHalachicTerm(key: string): HalachicTerm | undefined {
  return HALACHIC_GLOSSARY[key];
}

/**
 * Get all terms in a category
 */
export function getTermsByCategory(category: HalachicTerm['category']): HalachicTerm[] {
  return Object.values(HALACHIC_GLOSSARY).filter((term) => term.category === category);
}

/**
 * Format a term for display with Hebrew
 */
export function formatTermWithHebrew(key: string): string {
  const term = HALACHIC_GLOSSARY[key];
  if (!term) return key;
  return `${term.transliteration} (${term.hebrew})`;
}
