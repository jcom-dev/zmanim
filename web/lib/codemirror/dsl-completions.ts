// DSL Autocomplete definitions

export interface Completion {
  label: string;
  type: 'primitive' | 'function' | 'keyword' | 'reference';
  info: string;
  detail?: string;
  snippet?: string;
}

export const PRIMITIVE_COMPLETIONS: Completion[] = [
  { label: 'sunrise', type: 'primitive', info: 'Time when sun crosses horizon (morning)', detail: 'Netz HaChama' },
  { label: 'sunset', type: 'primitive', info: 'Time when sun crosses horizon (evening)', detail: 'Shkias HaChama' },
  { label: 'solar_noon', type: 'primitive', info: 'Time when sun is at highest point', detail: 'Chatzos HaYom' },
  { label: 'midnight', type: 'primitive', info: 'Solar midnight', detail: 'Chatzos HaLailah' },
  { label: 'civil_dawn', type: 'primitive', info: 'When sun is 6° below horizon (morning)' },
  { label: 'civil_dusk', type: 'primitive', info: 'When sun is 6° below horizon (evening)' },
  { label: 'alos_hashachar', type: 'primitive', info: 'Dawn - typically 72 min before sunrise or 16.1°', detail: 'עלות השחר' },
  { label: 'misheyakir', type: 'primitive', info: 'Earliest time for tallis/tefillin', detail: 'משיכיר' },
  { label: 'tzeis_hakochavim', type: 'primitive', info: 'Nightfall - three stars visible', detail: 'צאת הכוכבים' },
];

export const FUNCTION_COMPLETIONS: Completion[] = [
  {
    label: 'solar',
    type: 'function',
    info: 'Calculate time based on solar angle',
    detail: 'solar(degrees, direction)',
    snippet: 'solar(${1:16.1}, ${2:before_sunrise})',
  },
  {
    label: 'seasonal_solar',
    type: 'function',
    info: 'Seasonal solar angle (ROY method) - scales by day length',
    detail: 'seasonal_solar(degrees, direction)',
    snippet: 'seasonal_solar(${1:16.04}, ${2:before_sunrise})',
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
    snippet: 'midpoint(${1:sunrise}, ${2:sunset})',
  },
  {
    label: 'if',
    type: 'function',
    info: 'Conditional expression',
    detail: 'if(condition) { then } else { else }',
    snippet: 'if (${1:condition}) { ${2:then} } else { ${3:else} }',
  },
];

export const KEYWORD_COMPLETIONS: Completion[] = [
  { label: 'before_sunrise', type: 'keyword', info: 'Direction: before sunrise' },
  { label: 'after_sunset', type: 'keyword', info: 'Direction: after sunset' },
  { label: 'gra', type: 'keyword', info: 'GRA system: sunrise to sunset', detail: 'Vilna Gaon' },
  { label: 'mga', type: 'keyword', info: 'MGA system: dawn to nightfall', detail: 'Magen Avraham' },
  { label: 'custom', type: 'keyword', info: 'Custom day definition' },
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
