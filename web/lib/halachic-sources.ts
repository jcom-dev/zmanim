// Halachic sources for autocomplete and citations

export interface HalachicSource {
  id: string;
  name: string;
  hebrew: string;
  abbreviation?: string;
  type: 'talmud' | 'rishonim' | 'acharonim' | 'shulchan_aruch' | 'contemporary';
  sefariaLink?: string;
}

export const HALACHIC_SOURCES: HalachicSource[] = [
  // Shulchan Aruch and commentaries
  {
    id: 'sa',
    name: 'Shulchan Aruch',
    hebrew: 'שולחן ערוך',
    abbreviation: 'SA',
    type: 'shulchan_aruch',
    sefariaLink: 'https://www.sefaria.org/Shulchan_Arukh',
  },
  {
    id: 'rema',
    name: 'Rema',
    hebrew: 'רמ"א',
    type: 'shulchan_aruch',
  },
  {
    id: 'mb',
    name: 'Mishnah Berurah',
    hebrew: 'משנה ברורה',
    abbreviation: 'MB',
    type: 'acharonim',
    sefariaLink: 'https://www.sefaria.org/Mishnah_Berurah',
  },
  {
    id: 'bhl',
    name: 'Biur Halacha',
    hebrew: 'ביאור הלכה',
    type: 'acharonim',
  },
  {
    id: 'shaar',
    name: 'Shaar HaTziyun',
    hebrew: 'שער הציון',
    type: 'acharonim',
  },

  // Talmud
  {
    id: 'gemara',
    name: 'Talmud Bavli',
    hebrew: 'תלמוד בבלי',
    type: 'talmud',
    sefariaLink: 'https://www.sefaria.org/texts/Talmud',
  },
  {
    id: 'yerushalmi',
    name: 'Talmud Yerushalmi',
    hebrew: 'תלמוד ירושלמי',
    type: 'talmud',
  },

  // Rishonim
  {
    id: 'rambam',
    name: 'Rambam (Mishneh Torah)',
    hebrew: 'רמב"ם',
    type: 'rishonim',
    sefariaLink: 'https://www.sefaria.org/texts/Halakhah/Mishneh%20Torah',
  },
  {
    id: 'tur',
    name: 'Tur',
    hebrew: 'טור',
    type: 'rishonim',
    sefariaLink: 'https://www.sefaria.org/texts/Halakhah/Tur',
  },
  {
    id: 'rosh',
    name: 'Rosh',
    hebrew: 'רא"ש',
    type: 'rishonim',
  },
  {
    id: 'rif',
    name: 'Rif',
    hebrew: 'רי"ף',
    type: 'rishonim',
  },
  {
    id: 'ritam',
    name: "Rabbeinu Tam",
    hebrew: 'ר"ת',
    type: 'rishonim',
  },

  // Acharonim
  {
    id: 'magen_avraham',
    name: 'Magen Avraham',
    hebrew: 'מגן אברהם',
    abbreviation: 'MA',
    type: 'acharonim',
  },
  {
    id: 'taz',
    name: 'Taz',
    hebrew: 'ט"ז',
    type: 'acharonim',
  },
  {
    id: 'gra',
    name: 'Vilna Gaon',
    hebrew: 'הגר"א',
    type: 'acharonim',
  },
  {
    id: 'aruch_hashulchan',
    name: 'Aruch HaShulchan',
    hebrew: 'ערוך השלחן',
    type: 'acharonim',
    sefariaLink: 'https://www.sefaria.org/texts/Halakhah/Arukh%20HaShulchan',
  },

  // Contemporary
  {
    id: 'igm',
    name: 'Igros Moshe',
    hebrew: 'אגרות משה',
    type: 'contemporary',
  },
  {
    id: 'yalkut_yosef',
    name: 'Yalkut Yosef',
    hebrew: 'ילקוט יוסף',
    type: 'contemporary',
  },
  {
    id: 'shevet_halevi',
    name: 'Shevet HaLevi',
    hebrew: 'שבט הלוי',
    type: 'contemporary',
  },
  {
    id: 'minchas_yitzchak',
    name: 'Minchas Yitzchak',
    hebrew: 'מנחת יצחק',
    type: 'contemporary',
  },
];

// Common citation patterns
export const CITATION_PATTERNS = [
  { pattern: 'OC', description: 'Orach Chaim', hebrew: 'או"ח' },
  { pattern: 'YD', description: 'Yoreh Deah', hebrew: 'יו"ד' },
  { pattern: 'EH', description: 'Even HaEzer', hebrew: 'אה"ע' },
  { pattern: 'CM', description: 'Choshen Mishpat', hebrew: 'חו"מ' },
];

/**
 * Format a citation reference
 */
export function formatCitation(sourceId: string, reference: string): string {
  const source = HALACHIC_SOURCES.find((s) => s.id === sourceId);
  if (!source) {
    return `[${sourceId} ${reference}]`;
  }
  return `[${source.name} ${reference}]`;
}

/**
 * Format a citation with Hebrew
 */
export function formatCitationHebrew(sourceId: string, reference: string): string {
  const source = HALACHIC_SOURCES.find((s) => s.id === sourceId);
  if (!source) {
    return `[${sourceId} ${reference}]`;
  }
  return `[${source.hebrew} ${reference}]`;
}

/**
 * Get Sefaria link for a source if available
 */
export function getSefariaLink(sourceId: string): string | null {
  const source = HALACHIC_SOURCES.find((s) => s.id === sourceId);
  return source?.sefariaLink || null;
}

/**
 * Search sources by name (English or Hebrew)
 */
export function searchSources(query: string): HalachicSource[] {
  const lowerQuery = query.toLowerCase();
  return HALACHIC_SOURCES.filter(
    (source) =>
      source.name.toLowerCase().includes(lowerQuery) ||
      source.hebrew.includes(query) ||
      source.abbreviation?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get sources by type
 */
export function getSourcesByType(type: HalachicSource['type']): HalachicSource[] {
  return HALACHIC_SOURCES.filter((source) => source.type === type);
}
