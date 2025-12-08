/**
 * @file dsl-reference-data.ts
 * @purpose DSL syntax reference - primitives, operators, functions, examples
 * @pattern reference-data
 * @dependencies Used by DSL editor, formula builder
 * @frequency high - 455 lines
 * @compliance Check docs/adr/ for pattern rationale
 */

// DSL Reference Data for the Advanced DSL Editor
// This file contains all the primitives, functions, operators, and examples

export interface QuickInsertChip {
  value: string;
  label: string;
  description: string;
}

export interface ParameterInfo {
  name: string;
  type: string;
  description: string;
  defaultValue: string;
  commonValues?: QuickInsertChip[];
}

export interface ReferenceItem {
  name: string;
  signature?: string;
  description: string;
  snippet: string;
  category: 'primitive' | 'function' | 'operator' | 'reference';
  // Real-world example for insertion (Story 5.3)
  realWorldExample?: string;
  // Parameter information for functions
  parameters?: ParameterInfo[];
  // Quick insert chips
  quickInsertChips?: QuickInsertChip[];
}

export interface ExamplePattern {
  formula: string;
  description: string;
}

export const DSL_PRIMITIVES: ReferenceItem[] = [
  // Core astronomical events
  {
    name: 'sunrise',
    description: 'Start of visible sun (netz hachama)',
    snippet: 'sunrise',
    category: 'primitive',
  },
  {
    name: 'sunset',
    description: 'End of visible sun (shkiah)',
    snippet: 'sunset',
    category: 'primitive',
  },
  {
    name: 'solar_noon',
    description: 'Sun at highest point (chatzos hayom)',
    snippet: 'solar_noon',
    category: 'primitive',
  },
  {
    name: 'solar_midnight',
    description: 'Solar midnight (chatzos halayla)',
    snippet: 'solar_midnight',
    category: 'primitive',
  },
  // Visible sunrise/sunset (with atmospheric refraction)
  {
    name: 'visible_sunrise',
    description: 'Visible sunrise accounting for atmospheric refraction',
    snippet: 'visible_sunrise',
    category: 'primitive',
  },
  {
    name: 'visible_sunset',
    description: 'Visible sunset accounting for atmospheric refraction',
    snippet: 'visible_sunset',
    category: 'primitive',
  },
  // Civil twilight (-6°)
  {
    name: 'civil_dawn',
    description: 'Civil dawn - sun at 6° below horizon (morning)',
    snippet: 'civil_dawn',
    category: 'primitive',
  },
  {
    name: 'civil_dusk',
    description: 'Civil dusk - sun at 6° below horizon (evening)',
    snippet: 'civil_dusk',
    category: 'primitive',
  },
  // Nautical twilight (-12°)
  {
    name: 'nautical_dawn',
    description: 'Nautical dawn - sun at 12° below horizon (morning)',
    snippet: 'nautical_dawn',
    category: 'primitive',
  },
  {
    name: 'nautical_dusk',
    description: 'Nautical dusk - sun at 12° below horizon (evening)',
    snippet: 'nautical_dusk',
    category: 'primitive',
  },
  // Astronomical twilight (-18°)
  {
    name: 'astronomical_dawn',
    description: 'Astronomical dawn - sun at 18° below horizon (morning)',
    snippet: 'astronomical_dawn',
    category: 'primitive',
  },
  {
    name: 'astronomical_dusk',
    description: 'Astronomical dusk - sun at 18° below horizon (evening)',
    snippet: 'astronomical_dusk',
    category: 'primitive',
  },
];

export const DSL_FUNCTIONS: ReferenceItem[] = [
  // Solar angle function
  {
    name: 'solar',
    signature: 'solar(degrees, direction)',
    description: 'Time when sun reaches angle. Directions: before_sunrise, after_sunset, before_noon, after_noon',
    snippet: 'solar(degrees, direction)',
    realWorldExample: 'solar(16.1, before_sunrise)',
    category: 'function',
    parameters: [
      {
        name: 'degrees',
        type: 'number',
        description: 'Sun angle below horizon (0-90)',
        defaultValue: '16.1',
        commonValues: [
          { value: '8.5', label: '8.5°', description: 'Tzeis (nightfall)' },
          { value: '11', label: '11°', description: 'Misheyakir' },
          { value: '16.1', label: '16.1°', description: 'Alos (MGA)' },
          { value: '18', label: '18°', description: 'Astronomical twilight' },
        ],
      },
      {
        name: 'direction',
        type: 'keyword',
        description: 'When the angle occurs',
        defaultValue: 'before_sunrise',
        commonValues: [
          { value: 'before_sunrise', label: 'before_sunrise', description: 'Morning (dawn)' },
          { value: 'after_sunset', label: 'after_sunset', description: 'Evening (tzeis)' },
        ],
      },
    ],
    quickInsertChips: [
      { value: 'solar(16.1, before_sunrise)', label: 'Alos 16.1°', description: 'MGA dawn' },
      { value: 'solar(8.5, after_sunset)', label: 'Tzeis 8.5°', description: 'Nightfall' },
      { value: 'solar(11, before_sunrise)', label: 'Misheyakir 11°', description: 'Tallis/tefillin' },
    ],
  },
  // Seasonal solar angle function (ROY/Zemaneh-Yosef method)
  {
    name: 'seasonal_solar',
    signature: 'seasonal_solar(degrees, direction)',
    description: 'Seasonal/proportional solar angle (ROY method). Scales equinox-based offset by day length. Directions: before_sunrise, after_sunset only',
    snippet: 'seasonal_solar(degrees, direction)',
    realWorldExample: 'seasonal_solar(16.04, before_sunrise)',
    category: 'function',
    parameters: [
      {
        name: 'degrees',
        type: 'number',
        description: 'Sun angle below horizon (0-90)',
        defaultValue: '16.04',
        commonValues: [
          { value: '8.5', label: '8.5°', description: 'Tzeis (nightfall)' },
          { value: '11.5', label: '11.5°', description: 'Misheyakir (ROY)' },
          { value: '16.04', label: '16.04°', description: 'Alos (ROY)' },
        ],
      },
      {
        name: 'direction',
        type: 'keyword',
        description: 'When the angle occurs (before_sunrise or after_sunset only)',
        defaultValue: 'before_sunrise',
        commonValues: [
          { value: 'before_sunrise', label: 'before_sunrise', description: 'Morning (dawn)' },
          { value: 'after_sunset', label: 'after_sunset', description: 'Evening (tzeis)' },
        ],
      },
    ],
    quickInsertChips: [
      { value: 'seasonal_solar(16.04, before_sunrise)', label: 'Alos ROY', description: 'Dawn (seasonal)' },
      { value: 'seasonal_solar(8.5, after_sunset)', label: 'Tzeis ROY', description: 'Nightfall (seasonal)' },
      { value: 'seasonal_solar(11.5, before_sunrise)', label: 'Misheyakir ROY', description: 'Tallis/tefillin (seasonal)' },
    ],
  },
  // Proportional hours (sha'os zmaniyos)
  {
    name: 'proportional_hours',
    signature: 'proportional_hours(hours, base)',
    description: 'Proportional hours. Bases: gra (sunrise-sunset), mga (72min), mga_90, mga_120',
    snippet: 'proportional_hours(hours, base)',
    realWorldExample: 'proportional_hours(4, gra)',
    category: 'function',
    parameters: [
      {
        name: 'hours',
        type: 'number',
        description: 'Number of proportional hours',
        defaultValue: '4',
        commonValues: [
          { value: '3', label: '3 hours', description: 'Latest Shema' },
          { value: '4', label: '4 hours', description: 'Latest Shacharis' },
          { value: '6', label: '6 hours', description: 'Chatzos' },
          { value: '9.5', label: '9.5 hours', description: 'Mincha Ketana' },
          { value: '10.75', label: '10.75 hours', description: 'Plag HaMincha' },
        ],
      },
      {
        name: 'base',
        type: 'keyword',
        description: 'Day calculation system',
        defaultValue: 'gra',
        commonValues: [
          { value: 'gra', label: 'gra', description: 'GRA (sunrise to sunset)' },
          { value: 'mga', label: 'mga', description: 'MGA (72 min before/after)' },
          { value: 'mga_90', label: 'mga_90', description: 'MGA 90 (90 min before/after)' },
          { value: 'mga_120', label: 'mga_120', description: 'MGA 120 (120 min before/after)' },
          { value: 'custom(@alos, @tzeis)', label: 'custom', description: 'Custom day boundaries' },
        ],
      },
    ],
    quickInsertChips: [
      { value: 'proportional_hours(3, gra)', label: 'Shema GRA', description: 'Latest Shema (GRA)' },
      { value: 'proportional_hours(4, gra)', label: 'Tefila GRA', description: 'Latest Shacharis (GRA)' },
      { value: 'proportional_hours(3, mga)', label: 'Shema MGA', description: 'Latest Shema (MGA)' },
    ],
  },
  // Midpoint function
  {
    name: 'midpoint',
    signature: 'midpoint(a, b)',
    description: 'Returns the midpoint between two times',
    snippet: 'midpoint(a, b)',
    realWorldExample: 'midpoint(sunrise, sunset)',
    category: 'function',
    parameters: [
      {
        name: 'a',
        type: 'time',
        description: 'First time value',
        defaultValue: 'sunrise',
      },
      {
        name: 'b',
        type: 'time',
        description: 'Second time value',
        defaultValue: 'sunset',
      },
    ],
    quickInsertChips: [
      { value: 'midpoint(sunrise, sunset)', label: 'Chatzos', description: 'Solar noon' },
    ],
  },
  // Min function
  {
    name: 'min',
    signature: 'min(a, b)',
    description: 'Returns the earlier of two times',
    snippet: 'min(a, b)',
    realWorldExample: 'min(sunset - 40min, @plag)',
    category: 'function',
    parameters: [
      { name: 'a', type: 'time', description: 'First time value', defaultValue: 'sunset - 40min' },
      { name: 'b', type: 'time', description: 'Second time value', defaultValue: '@plag' },
    ],
  },
  // Max function
  {
    name: 'max',
    signature: 'max(a, b)',
    description: 'Returns the later of two times',
    snippet: 'max(a, b)',
    realWorldExample: 'max(@mincha_gedola, solar_noon + 30min)',
    category: 'function',
    parameters: [
      { name: 'a', type: 'time', description: 'First time value', defaultValue: '@mincha_gedola' },
      { name: 'b', type: 'time', description: 'Second time value', defaultValue: 'solar_noon + 30min' },
    ],
  },
];

// Day boundary systems for proportional_hours calculations
export const DSL_PROPORTIONAL_BASES: ReferenceItem[] = [
  {
    name: 'gra',
    description: 'GRA method: sunrise to sunset',
    snippet: 'gra',
    category: 'function',
  },
  {
    name: 'mga',
    description: 'MGA method: 72 min before sunrise to 72 min after sunset',
    snippet: 'mga',
    category: 'function',
  },
  {
    name: 'mga_90',
    description: 'MGA 90 method: 90 min before sunrise to 90 min after sunset',
    snippet: 'mga_90',
    category: 'function',
  },
  {
    name: 'mga_120',
    description: 'MGA 120 method: 120 min before sunrise to 120 min after sunset',
    snippet: 'mga_120',
    category: 'function',
  },
  {
    name: 'custom',
    signature: 'custom(start, end)',
    description: 'Custom day boundaries: define your own dawn and dusk times',
    snippet: 'custom(start, end)',
    realWorldExample: 'custom(solar(16.1, before_sunrise), solar(8.5, after_sunset))',
    category: 'function',
    parameters: [
      {
        name: 'start',
        type: 'time',
        description: 'Day start time (e.g., your alos definition)',
        defaultValue: 'solar(16.1, before_sunrise)',
      },
      {
        name: 'end',
        type: 'time',
        description: 'Day end time (e.g., your tzeis definition)',
        defaultValue: 'solar(8.5, after_sunset)',
      },
    ],
    quickInsertChips: [
      { value: 'custom(@alos, @tzeis)', label: 'Reference-based', description: 'Use your own alos/tzeis' },
      { value: 'custom(solar(16.1, before_sunrise), solar(8.5, after_sunset))', label: '16.1°/8.5°', description: 'Angle-based day' },
      { value: 'custom(sunrise - 72min, sunset + 72min)', label: '72 min offset', description: 'MGA style with fixed minutes' },
    ],
  },
];

// Solar directions for reference
export const DSL_DIRECTIONS: ReferenceItem[] = [
  {
    name: 'before_sunrise',
    description: 'Morning: sun ascending before sunrise',
    snippet: 'before_sunrise',
    category: 'function',
  },
  {
    name: 'after_sunset',
    description: 'Evening: sun descending after sunset',
    snippet: 'after_sunset',
    category: 'function',
  },
  {
    name: 'before_noon',
    description: 'Morning: sun ascending before solar noon',
    snippet: 'before_noon',
    category: 'function',
  },
  {
    name: 'after_noon',
    description: 'Afternoon: sun descending after solar noon',
    snippet: 'after_noon',
    category: 'function',
  },
];

export const DSL_OPERATORS: ReferenceItem[] = [
  {
    name: '+',
    description: 'Add duration (e.g., sunrise + 30min)',
    snippet: ' + ',
    category: 'operator',
  },
  {
    name: '-',
    description: 'Subtract duration (e.g., sunset - 18min)',
    snippet: ' - ',
    category: 'operator',
  },
  {
    name: 'min',
    description: 'Minutes unit (e.g., 72min)',
    snippet: 'min',
    category: 'operator',
  },
  {
    name: 'hr',
    description: 'Hours unit (e.g., 1hr)',
    snippet: 'hr',
    category: 'operator',
  },
  {
    name: '&&',
    description: 'Logical AND (e.g., month >= 5 && latitude > 50)',
    snippet: ' && ',
    category: 'operator',
  },
  {
    name: '||',
    description: 'Logical OR (e.g., month == 5 || month == 6)',
    snippet: ' || ',
    category: 'operator',
  },
  {
    name: '!',
    description: 'Logical NOT (e.g., !(latitude > 50))',
    snippet: '!',
    category: 'operator',
  },
];

export const EXAMPLE_PATTERNS: ExamplePattern[] = [
  {
    formula: 'sunrise - 72min',
    description: 'Dawn - 72 fixed minutes before sunrise',
  },
  {
    formula: 'solar(16.1, before_sunrise)',
    description: 'Dawn at 16.1° (Magen Avraham)',
  },
  {
    formula: 'proportional_hours(4, gra)',
    description: 'End of 4th proportional hour (Sof Zman Shema)',
  },
  {
    formula: 'proportional_hours(3, custom(@alos, @tzeis))',
    description: 'Shema using custom day boundaries (references your alos/tzeis)',
  },
  {
    formula: 'proportional_hours(4, custom(solar(16.1, before_sunrise), solar(8.5, after_sunset)))',
    description: 'Tefila using 16.1°/8.5° angle-based day',
  },
  {
    formula: 'sunset - 18min',
    description: 'Candle lighting - 18 min before sunset',
  },
  {
    formula: 'solar(8.5, after_sunset)',
    description: 'Tzeis - 8.5° after sunset',
  },
  {
    formula: 'sunset + 72min',
    description: 'Tzeis - 72 minutes after sunset (Rabbeinu Tam)',
  },
];

// Helper to get all reference items
export function getAllReferenceItems(): ReferenceItem[] {
  return [...DSL_PRIMITIVES, ...DSL_FUNCTIONS, ...DSL_OPERATORS];
}

// Helper to create reference items from zmanim keys
export function createZmanimReferences(zmanimKeys: string[]): ReferenceItem[] {
  return zmanimKeys.map((key) => ({
    name: `@${key}`,
    description: `Reference to ${key.replace(/_/g, ' ')}`,
    snippet: `@${key}`,
    category: 'reference' as const,
  }));
}

// Helper to escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to check if a term is used in a formula
export function isTermInFormula(term: string, formula: string): boolean {
  // For references, check exact match with @
  if (term.startsWith('@')) {
    return formula.includes(term);
  }
  // For operators (special characters like +, -), use simple includes
  if (DSL_OPERATORS.some(op => op.name === term)) {
    return formula.includes(term);
  }
  // For functions, check if function name is followed by (
  if (DSL_FUNCTIONS.some(f => f.name === term)) {
    const escapedTerm = escapeRegex(term);
    const regex = new RegExp(`\\b${escapedTerm}\\s*\\(`);
    return regex.test(formula);
  }
  // For primitives, check word boundary
  const escapedTerm = escapeRegex(term);
  const regex = new RegExp(`\\b${escapedTerm}\\b`);
  return regex.test(formula);
}
