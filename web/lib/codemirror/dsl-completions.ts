// DSL Autocomplete definitions

export interface Completion {
  label: string;
  type: 'primitive' | 'function' | 'keyword' | 'reference';
  info: string;
  detail?: string;
  snippet?: string;
}

export const PRIMITIVE_COMPLETIONS: Completion[] = [
  { label: 'visible_sunrise', type: 'primitive', info: 'Visible sunrise - first edge of sun appears above horizon (includes atmospheric refraction)', detail: 'Netz HaChama' },
  { label: 'visible_sunset', type: 'primitive', info: 'Visible sunset - last edge of sun disappears below horizon (includes atmospheric refraction)', detail: 'Shkias HaChama' },
  { label: 'geometric_sunrise', type: 'primitive', info: 'Geometric sunrise - sun center at horizon (no refraction)' },
  { label: 'geometric_sunset', type: 'primitive', info: 'Geometric sunset - sun center at horizon (no refraction)' },
  { label: 'solar_noon', type: 'primitive', info: 'Time when sun is at highest point', detail: 'Chatzos HaYom' },
  { label: 'solar_midnight', type: 'primitive', info: 'Solar midnight', detail: 'Chatzos HaLailah' },
  { label: 'civil_dawn', type: 'primitive', info: 'When sun is 6° below horizon (morning)' },
  { label: 'civil_dusk', type: 'primitive', info: 'When sun is 6° below horizon (evening)' },
  { label: 'nautical_dawn', type: 'primitive', info: 'When sun is 12° below horizon (morning)' },
  { label: 'nautical_dusk', type: 'primitive', info: 'When sun is 12° below horizon (evening)' },
  { label: 'astronomical_dawn', type: 'primitive', info: 'When sun is 18° below horizon (morning)' },
  { label: 'astronomical_dusk', type: 'primitive', info: 'When sun is 18° below horizon (evening)' },
];

export const FUNCTION_COMPLETIONS: Completion[] = [
  {
    label: 'solar',
    type: 'function',
    info: 'Calculate time based on solar angle',
    detail: 'solar(degrees, direction)',
    snippet: 'solar(${1:16.1}, ${2:before_visible_sunrise})',
  },
  {
    label: 'seasonal_solar',
    type: 'function',
    info: 'Seasonal solar angle (ROY method) - scales by day length',
    detail: 'seasonal_solar(degrees, direction)',
    snippet: 'seasonal_solar(${1:16.04}, ${2:before_visible_sunrise})',
  },
  {
    label: 'proportional_hours',
    type: 'function',
    info: 'Calculate using proportional hours',
    detail: 'proportional_hours(hours, base)',
    snippet: 'proportional_hours(${1:3}, ${2:gra})',
  },
  {
    label: 'midpoint',
    type: 'function',
    info: 'Calculate middle point between two times',
    detail: 'midpoint(time1, time2)',
    snippet: 'midpoint(${1:visible_sunrise}, ${2:visible_sunset})',
  },
  {
    label: 'if',
    type: 'function',
    info: 'Conditional expression',
    detail: 'if(condition) { then } else { else }',
    snippet: 'if (${1:condition}) { ${2:then} } else { ${3:else} }',
  },
  {
    label: 'proportional_minutes',
    type: 'function',
    info: 'Calculates proportional minutes based on day length. Formula: offset = (minutes / 720) × day_length',
    detail: 'proportional_minutes(minutes, before_visible_sunrise|after_visible_sunset)',
    snippet: 'proportional_minutes(${1:minutes}, ${2:direction})',
  },
  {
    label: 'first_valid',
    type: 'function',
    info: 'Returns the first non-null value from a list of expressions. Useful for fallback calculations.',
    detail: 'first_valid(expr1, expr2, ...)',
    snippet: 'first_valid(${1:primary}, ${2:fallback})',
  },
  {
    label: 'earlier_of',
    type: 'function',
    info: 'Returns whichever time comes first chronologically',
    snippet: 'earlier_of(${1:time1}, ${2:time2})',
  },
  {
    label: 'later_of',
    type: 'function',
    info: 'Returns whichever time comes last chronologically',
    snippet: 'later_of(${1:time1}, ${2:time2})',
  },
];

export const KEYWORD_COMPLETIONS: Completion[] = [
  // Directions
  { label: 'before_visible_sunrise', type: 'keyword', info: 'Direction: before sunrise' },
  { label: 'after_visible_sunset', type: 'keyword', info: 'Direction: after sunset' },
  { label: 'before_noon', type: 'keyword', info: 'Direction: before noon (sun ascending)' },
  { label: 'after_noon', type: 'keyword', info: 'Direction: after noon (sun descending)' },

  // Standard bases
  { label: 'gra', type: 'keyword', info: 'GRA system: sunrise to sunset', detail: 'Vilna Gaon' },
  { label: 'baal_hatanya', type: 'keyword', info: 'Netz Amiti (1.583° below horizon) to Shkiah Amiti', detail: 'Shulchan Aruch HaRav (Chabad)' },

  // Fixed-minute MGA variants
  { label: 'mga', type: 'keyword', info: 'MGA system: 72 min before sunrise to 72 min after sunset', detail: 'Magen Avraham' },
  { label: 'mga_60', type: 'keyword', info: '60 min before sunrise to 60 min after sunset' },
  { label: 'mga_72', type: 'keyword', info: '72 min before sunrise to 72 min after sunset (same as mga)' },
  { label: 'mga_90', type: 'keyword', info: '90 min before sunrise to 90 min after sunset' },
  { label: 'mga_96', type: 'keyword', info: '96 min before sunrise to 96 min after sunset' },
  { label: 'mga_120', type: 'keyword', info: '120 min before sunrise to 120 min after sunset' },

  // Zmaniyos (proportional minute) MGA variants
  { label: 'mga_72_zmanis', type: 'keyword', info: '1/10th of day before sunrise to 1/10th after sunset (proportional)' },
  { label: 'mga_90_zmanis', type: 'keyword', info: '1/8th of day before sunrise to 1/8th after sunset (proportional)' },
  { label: 'mga_96_zmanis', type: 'keyword', info: '1/7.5th of day before sunrise to 1/7.5th after sunset (proportional)' },

  // Solar angle MGA variants
  { label: 'mga_16_1', type: 'keyword', info: '16.1° below horizon (72-min equivalent at Jerusalem equinox)' },
  { label: 'mga_18', type: 'keyword', info: '18° below horizon (astronomical twilight)' },
  { label: 'mga_19_8', type: 'keyword', info: '19.8° below horizon (90-min equivalent at Jerusalem equinox)' },
  { label: 'mga_26', type: 'keyword', info: '26° below horizon (120-min equivalent at Jerusalem equinox)' },

  // Sephardic bases
  { label: 'ateret_torah', type: 'keyword', info: 'Sephardic method: sunrise to tzais 40 minutes', detail: 'Ateret Torah' },

  // Custom
  { label: 'custom', type: 'keyword', info: 'Custom day definition: custom(start, end)' },
];

// Get all completions
export function getAllCompletions(): Completion[] {
  return [...PRIMITIVE_COMPLETIONS, ...FUNCTION_COMPLETIONS, ...KEYWORD_COMPLETIONS];
}

// Filter completions by prefix
export function getCompletions(prefix: string): Completion[] {
  const lowerPrefix = prefix.toLowerCase();
  return getAllCompletions().filter(
    (c) => c.label.toLowerCase().startsWith(lowerPrefix)
  );
}

// Get reference completions (for @zman_key)
export function getReferenceCompletions(zmanimKeys: string[]): Completion[] {
  return zmanimKeys.map((key) => ({
    label: `@${key}`,
    type: 'reference' as const,
    info: `Reference to ${key}`,
  }));
}
