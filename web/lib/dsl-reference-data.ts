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
    name: 'visible_sunrise',
    description: 'Visible sunrise - first edge of sun appears above horizon (includes atmospheric refraction)',
    snippet: 'visible_sunrise',
    category: 'primitive',
  },
  {
    name: 'visible_sunset',
    description: 'Visible sunset - last edge of sun disappears below horizon (includes atmospheric refraction)',
    snippet: 'visible_sunset',
    category: 'primitive',
  },
  {
    name: 'geometric_sunrise',
    description: 'Geometric sunrise - sun center at horizon (no refraction)',
    snippet: 'geometric_sunrise',
    category: 'primitive',
  },
  {
    name: 'geometric_sunset',
    description: 'Geometric sunset - sun center at horizon (no refraction)',
    snippet: 'geometric_sunset',
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
    description: 'Time when sun reaches angle. Directions: before_visible_sunrise, after_visible_sunset, before_noon, after_noon',
    snippet: 'solar(degrees, direction)',
    realWorldExample: 'solar(16.1, before_visible_sunrise)',
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
        defaultValue: 'before_visible_sunrise',
        commonValues: [
          { value: 'before_visible_sunrise', label: 'before_visible_sunrise', description: 'Before visible sunrise (standard)' },
          { value: 'after_visible_sunset', label: 'after_visible_sunset', description: 'After visible sunset (standard)' },
          { value: 'before_geometric_sunrise', label: 'before_geometric_sunrise', description: 'Before geometric sunrise (no refraction)' },
          { value: 'after_geometric_sunset', label: 'after_geometric_sunset', description: 'After geometric sunset (no refraction)' },
          { value: 'before_noon', label: 'before_noon', description: 'Before solar noon' },
          { value: 'after_noon', label: 'after_noon', description: 'After solar noon' },
        ],
      },
    ],
    quickInsertChips: [
      { value: 'solar(16.1, before_visible_sunrise)', label: 'Alos 16.1°', description: 'MGA dawn' },
      { value: 'solar(8.5, after_visible_sunset)', label: 'Tzeis 8.5°', description: 'Nightfall' },
      { value: 'solar(11, before_visible_sunrise)', label: 'Misheyakir 11°', description: 'Tallis/tefillin' },
    ],
  },
  // Seasonal solar angle function (ROY/Zemaneh-Yosef method)
  {
    name: 'seasonal_solar',
    signature: 'seasonal_solar(degrees, direction)',
    description: 'Seasonal/proportional solar angle (ROY method). Scales equinox-based offset by day length. Directions: before_visible_sunrise, after_visible_sunset only',
    snippet: 'seasonal_solar(degrees, direction)',
    realWorldExample: 'seasonal_solar(16.04, before_visible_sunrise)',
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
        description: 'When the angle occurs (visible or geometric sunrise/sunset)',
        defaultValue: 'before_visible_sunrise',
        commonValues: [
          { value: 'before_visible_sunrise', label: 'before_visible_sunrise', description: 'Before visible sunrise (standard)' },
          { value: 'after_visible_sunset', label: 'after_visible_sunset', description: 'After visible sunset (standard)' },
          { value: 'before_geometric_sunrise', label: 'before_geometric_sunrise', description: 'Before geometric sunrise (no refraction)' },
          { value: 'after_geometric_sunset', label: 'after_geometric_sunset', description: 'After geometric sunset (no refraction)' },
        ],
      },
    ],
    quickInsertChips: [
      { value: 'seasonal_solar(16.04, before_visible_sunrise)', label: 'Alos ROY', description: 'Dawn (seasonal)' },
      { value: 'seasonal_solar(8.5, after_visible_sunset)', label: 'Tzeis ROY', description: 'Nightfall (seasonal)' },
      { value: 'seasonal_solar(11.5, before_visible_sunrise)', label: 'Misheyakir ROY', description: 'Tallis/tefillin (seasonal)' },
    ],
  },
  // Proportional hours (sha'os zmaniyos)
  {
    name: 'proportional_hours',
    signature: 'proportional_hours(hours, base)',
    description: 'Proportional hours. Bases: gra, mga variants (fixed/proportional/angles), baal_hatanya, ateret_torah, custom',
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
          { value: 'mga_60', label: 'mga_60', description: 'MGA 60 (60 min before/after)' },
          { value: 'mga_72', label: 'mga_72', description: 'MGA 72 (72 min before/after)' },
          { value: 'mga_90', label: 'mga_90', description: 'MGA 90 (90 min before/after)' },
          { value: 'mga_96', label: 'mga_96', description: 'MGA 96 (96 min before/after)' },
          { value: 'mga_120', label: 'mga_120', description: 'MGA 120 (120 min before/after)' },
          { value: 'mga_72_zmanis', label: 'mga_72_zmanis', description: 'MGA 72 proportional minutes' },
          { value: 'mga_90_zmanis', label: 'mga_90_zmanis', description: 'MGA 90 proportional minutes' },
          { value: 'mga_96_zmanis', label: 'mga_96_zmanis', description: 'MGA 96 proportional minutes' },
          { value: 'mga_16_1', label: 'mga_16_1', description: 'MGA 16.1° angle' },
          { value: 'mga_18', label: 'mga_18', description: 'MGA 18° angle' },
          { value: 'mga_19_8', label: 'mga_19_8', description: 'MGA 19.8° angle' },
          { value: 'mga_26', label: 'mga_26', description: 'MGA 26° angle' },
          { value: 'baal_hatanya', label: 'baal_hatanya', description: 'Baal HaTanya (Chabad)' },
          { value: 'ateret_torah', label: 'ateret_torah', description: 'Ateret Torah (sunrise to tzais 40 min)' },
          { value: 'custom(@alos, @tzeis)', label: 'custom', description: 'Custom day boundaries' },
        ],
      },
    ],
    quickInsertChips: [
      { value: 'proportional_hours(3, gra)', label: 'Shema GRA', description: 'Latest Shema (GRA)' },
      { value: 'proportional_hours(4, gra)', label: 'Tefila GRA', description: 'Latest Shacharis (GRA)' },
      { value: 'proportional_hours(3, mga)', label: 'Shema MGA', description: 'Latest Shema (MGA)' },
      { value: 'proportional_hours(10.75, ateret_torah)', label: 'Plag Ateret Torah', description: 'Plag HaMincha (Ateret Torah)' },
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
        defaultValue: 'visible_sunrise',
      },
      {
        name: 'b',
        type: 'time',
        description: 'Second time value',
        defaultValue: 'visible_sunset',
      },
    ],
    quickInsertChips: [
      { value: 'midpoint(visible_sunrise, visible_sunset)', label: 'Chatzos', description: 'Solar noon' },
    ],
  },
  // First valid function
  {
    name: 'first_valid',
    signature: 'first_valid(value1, value2, ...)',
    description: 'Returns the first non-nil value from arguments',
    snippet: 'first_valid(value1, value2)',
    realWorldExample: 'first_valid(solar(16.1, before_visible_sunrise), visible_sunrise - 72min)',
    category: 'function',
    parameters: [
      {
        name: 'value1',
        type: 'time',
        description: 'First time value to check',
        defaultValue: 'solar(16.1, before_visible_sunrise)',
      },
      {
        name: 'value2',
        type: 'time',
        description: 'Second time value to check',
        defaultValue: 'visible_sunrise - 72min',
      },
    ],
    quickInsertChips: [
      { value: 'first_valid(solar(16.1, before_visible_sunrise), visible_sunrise - 72min)', label: 'Fallback dawn', description: 'Use angle or fallback to fixed minutes' },
    ],
  },
  // Earlier of function
  {
    name: 'earlier_of',
    signature: 'earlier_of(time1, time2)',
    description: 'Returns whichever time comes first chronologically',
    snippet: 'earlier_of(time1, time2)',
    realWorldExample: 'earlier_of(visible_sunrise, civil_dawn)',
    category: 'function',
    parameters: [
      {
        name: 'time1',
        type: 'time',
        description: 'First time value',
        defaultValue: 'visible_sunrise',
      },
      {
        name: 'time2',
        type: 'time',
        description: 'Second time value',
        defaultValue: 'civil_dawn',
      },
    ],
    quickInsertChips: [
      { value: 'earlier_of(visible_sunrise, civil_dawn)', label: 'Earlier time', description: 'Returns whichever comes first' },
    ],
  },
  // Later of function
  {
    name: 'later_of',
    signature: 'later_of(time1, time2)',
    description: 'Returns whichever time comes last chronologically',
    snippet: 'later_of(time1, time2)',
    realWorldExample: 'later_of(visible_sunset, civil_dusk)',
    category: 'function',
    parameters: [
      {
        name: 'time1',
        type: 'time',
        description: 'First time value',
        defaultValue: 'visible_sunset',
      },
      {
        name: 'time2',
        type: 'time',
        description: 'Second time value',
        defaultValue: 'civil_dusk',
      },
    ],
    quickInsertChips: [
      { value: 'later_of(visible_sunset, civil_dusk)', label: 'Later time', description: 'Returns whichever comes last' },
    ],
  },
  // Proportional minutes function
  {
    name: 'proportional_minutes',
    signature: 'proportional_minutes(minutes, direction)',
    description: 'Calculates proportional minutes based on day length. Formula: offset = (minutes / 720) × day_length',
    snippet: 'proportional_minutes(minutes, direction)',
    realWorldExample: 'proportional_minutes(72, before_visible_sunrise)',
    category: 'function',
    parameters: [
      {
        name: 'minutes',
        type: 'number',
        description: 'Fixed minutes value (scaled proportionally)',
        defaultValue: '72',
        commonValues: [
          { value: '72', label: '72 min', description: 'MGA dawn/dusk' },
          { value: '90', label: '90 min', description: 'MGA 90' },
          { value: '120', label: '120 min', description: 'MGA 120' },
        ],
      },
      {
        name: 'direction',
        type: 'keyword',
        description: 'When to apply the offset',
        defaultValue: 'before_visible_sunrise',
        commonValues: [
          { value: 'before_visible_sunrise', label: 'before_visible_sunrise', description: 'Before visible sunrise (standard)' },
          { value: 'after_visible_sunset', label: 'after_visible_sunset', description: 'After visible sunset (standard)' },
          { value: 'before_geometric_sunrise', label: 'before_geometric_sunrise', description: 'Before geometric sunrise (no refraction)' },
          { value: 'after_geometric_sunset', label: 'after_geometric_sunset', description: 'After geometric sunset (no refraction)' },
        ],
      },
    ],
    quickInsertChips: [
      { value: 'proportional_minutes(72, before_visible_sunrise)', label: 'Prop 72min dawn', description: 'Dawn (proportional 72 min)' },
      { value: 'proportional_minutes(72, after_visible_sunset)', label: 'Prop 72min dusk', description: 'Dusk (proportional 72 min)' },
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
    name: 'mga_60',
    description: 'MGA 60 method: 60 min before sunrise to 60 min after sunset',
    snippet: 'mga_60',
    category: 'function',
  },
  {
    name: 'mga_72',
    description: 'MGA 72 method: 72 min before sunrise to 72 min after sunset',
    snippet: 'mga_72',
    category: 'function',
  },
  {
    name: 'mga_90',
    description: 'MGA 90 method: 90 min before sunrise to 90 min after sunset',
    snippet: 'mga_90',
    category: 'function',
  },
  {
    name: 'mga_96',
    description: 'MGA 96 method: 96 min before sunrise to 96 min after sunset',
    snippet: 'mga_96',
    category: 'function',
  },
  {
    name: 'mga_120',
    description: 'MGA 120 method: 120 min before sunrise to 120 min after sunset',
    snippet: 'mga_120',
    category: 'function',
  },
  {
    name: 'mga_72_zmanis',
    description: 'MGA 72 proportional method: 72 proportional minutes before/after sunrise/sunset',
    snippet: 'mga_72_zmanis',
    category: 'function',
  },
  {
    name: 'mga_90_zmanis',
    description: 'MGA 90 proportional method: 90 proportional minutes before/after sunrise/sunset',
    snippet: 'mga_90_zmanis',
    category: 'function',
  },
  {
    name: 'mga_96_zmanis',
    description: 'MGA 96 proportional method: 96 proportional minutes before/after sunrise/sunset',
    snippet: 'mga_96_zmanis',
    category: 'function',
  },
  {
    name: 'mga_16_1',
    description: 'MGA 16.1° method: solar angle 16.1° before/after sunrise/sunset',
    snippet: 'mga_16_1',
    category: 'function',
  },
  {
    name: 'mga_18',
    description: 'MGA 18° method: solar angle 18° before/after sunrise/sunset',
    snippet: 'mga_18',
    category: 'function',
  },
  {
    name: 'mga_19_8',
    description: 'MGA 19.8° method: solar angle 19.8° before/after sunrise/sunset',
    snippet: 'mga_19_8',
    category: 'function',
  },
  {
    name: 'mga_26',
    description: 'MGA 26° method: solar angle 26° before/after sunrise/sunset',
    snippet: 'mga_26',
    category: 'function',
  },
  {
    name: 'baal_hatanya',
    description: 'Baal HaTanya method: Chabad calculation system',
    snippet: 'baal_hatanya',
    category: 'function',
  },
  {
    name: 'ateret_torah',
    description: 'Ateret Torah method: sunrise to tzais 40 minutes (Sephardic method)',
    snippet: 'ateret_torah',
    category: 'function',
  },
  {
    name: 'custom',
    signature: 'custom(start, end)',
    description: 'Custom day boundaries: define your own dawn and dusk times',
    snippet: 'custom(start, end)',
    realWorldExample: 'custom(solar(16.1, before_visible_sunrise), solar(8.5, after_visible_sunset))',
    category: 'function',
    parameters: [
      {
        name: 'start',
        type: 'time',
        description: 'Day start time (e.g., your alos definition)',
        defaultValue: 'solar(16.1, before_visible_sunrise)',
      },
      {
        name: 'end',
        type: 'time',
        description: 'Day end time (e.g., your tzeis definition)',
        defaultValue: 'solar(8.5, after_visible_sunset)',
      },
    ],
    quickInsertChips: [
      { value: 'custom(@alos, @tzeis)', label: 'Reference-based', description: 'Use your own alos/tzeis' },
      { value: 'custom(solar(16.1, before_visible_sunrise), solar(8.5, after_visible_sunset))', label: '16.1°/8.5°', description: 'Angle-based day' },
      { value: 'custom(sunrise - 72min, sunset + 72min)', label: '72 min offset', description: 'MGA style with fixed minutes' },
    ],
  },
];

// Solar directions for reference
export const DSL_DIRECTIONS: ReferenceItem[] = [
  {
    name: 'before_visible_sunrise',
    description: 'Before visible sunrise (includes atmospheric refraction)',
    snippet: 'before_visible_sunrise',
    category: 'function',
  },
  {
    name: 'after_visible_sunrise',
    description: 'After visible sunrise (includes atmospheric refraction)',
    snippet: 'after_visible_sunrise',
    category: 'function',
  },
  {
    name: 'before_visible_sunset',
    description: 'Before visible sunset (includes atmospheric refraction)',
    snippet: 'before_visible_sunset',
    category: 'function',
  },
  {
    name: 'after_visible_sunset',
    description: 'After visible sunset (includes atmospheric refraction)',
    snippet: 'after_visible_sunset',
    category: 'function',
  },
  {
    name: 'before_geometric_sunrise',
    description: 'Before geometric sunrise (no refraction, sun center at horizon)',
    snippet: 'before_geometric_sunrise',
    category: 'function',
  },
  {
    name: 'after_geometric_sunrise',
    description: 'After geometric sunrise (no refraction, sun center at horizon)',
    snippet: 'after_geometric_sunrise',
    category: 'function',
  },
  {
    name: 'before_geometric_sunset',
    description: 'Before geometric sunset (no refraction, sun center at horizon)',
    snippet: 'before_geometric_sunset',
    category: 'function',
  },
  {
    name: 'after_geometric_sunset',
    description: 'After geometric sunset (no refraction, sun center at horizon)',
    snippet: 'after_geometric_sunset',
    category: 'function',
  },
  {
    name: 'before_noon',
    description: 'Before solar noon',
    snippet: 'before_noon',
    category: 'function',
  },
  {
    name: 'after_noon',
    description: 'After solar noon',
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
    name: '>',
    description: 'Greater than comparison (e.g., latitude > 50)',
    snippet: ' > ',
    category: 'operator',
  },
  {
    name: '<',
    description: 'Less than comparison (e.g., month < 6)',
    snippet: ' < ',
    category: 'operator',
  },
  {
    name: '>=',
    description: 'Greater than or equal (e.g., date >= 21-May)',
    snippet: ' >= ',
    category: 'operator',
  },
  {
    name: '<=',
    description: 'Less than or equal (e.g., day_length <= 600)',
    snippet: ' <= ',
    category: 'operator',
  },
  {
    name: '==',
    description: 'Equal to comparison (e.g., season == "summer")',
    snippet: ' == ',
    category: 'operator',
  },
  {
    name: '!=',
    description: 'Not equal to comparison (e.g., month != 12)',
    snippet: ' != ',
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

export const DSL_CONDITIONALS: ReferenceItem[] = [
  {
    name: 'if...else',
    signature: 'if (condition) { then_value } else { else_value }',
    description: 'Conditional logic for location or date-dependent calculations. Use with condition variables and comparison operators.',
    snippet: 'if (condition) { value1 } else { value2 }',
    category: 'operator',
    realWorldExample: 'if (latitude > 50) { sunrise - 90min } else { sunrise - 72min }',
  },
];

export const DSL_CONDITION_VARIABLES: ReferenceItem[] = [
  {
    name: 'latitude',
    description: 'Observer latitude in degrees (-90 to 90). Positive = North, Negative = South.',
    snippet: 'latitude',
    category: 'primitive',
  },
  {
    name: 'longitude',
    description: 'Observer longitude in degrees (-180 to 180). Positive = East, Negative = West.',
    snippet: 'longitude',
    category: 'primitive',
  },
  {
    name: 'day_length',
    description: 'Length of the current day in minutes (sunrise to sunset).',
    snippet: 'day_length',
    category: 'primitive',
  },
  {
    name: 'month',
    description: 'Current month (1-12). January = 1, December = 12.',
    snippet: 'month',
    category: 'primitive',
  },
  {
    name: 'day',
    description: 'Day of the month (1-31).',
    snippet: 'day',
    category: 'primitive',
  },
  {
    name: 'day_of_year',
    description: 'Day of the year (1-366). January 1 = 1.',
    snippet: 'day_of_year',
    category: 'primitive',
  },
  {
    name: 'date',
    description: 'Current date for comparison with date literals (e.g., date >= 21-May).',
    snippet: 'date',
    category: 'primitive',
  },
  {
    name: 'season',
    description: 'Current season: "spring", "summer", "autumn", or "winter". Adjusts for hemisphere.',
    snippet: 'season',
    category: 'primitive',
  },
];

export const DSL_DATE_LITERALS: ReferenceItem[] = [
  {
    name: 'Date Literals',
    description: 'Date format for seasonal comparisons: day-Month (e.g., 21-May, 1-Jan, 15-Sep). Used with the date variable.',
    snippet: '21-May',
    category: 'primitive',
    realWorldExample: 'if (date >= 21-Mar && date <= 21-Sep) { sunrise } else { sunrise + 10min }',
  },
];

export const EXAMPLE_PATTERNS: ExamplePattern[] = [
  {
    formula: 'sunrise - 72min',
    description: 'Dawn - 72 fixed minutes before sunrise',
  },
  {
    formula: 'proportional_minutes(72, before_visible_sunrise)',
    description: 'Dawn - 72 proportional minutes before sunrise',
  },
  {
    formula: 'solar(16.1, before_visible_sunrise)',
    description: 'Dawn at 16.1° (Magen Avraham)',
  },
  {
    formula: 'proportional_hours(4, gra)',
    description: 'End of 4th proportional hour (Sof Zman Shema)',
  },
  {
    formula: 'proportional_hours(10.75, ateret_torah)',
    description: 'Plag HaMincha (Ateret Torah - Sephardic method)',
  },
  {
    formula: 'proportional_hours(3, custom(@alos, @tzeis))',
    description: 'Shema using custom day boundaries (references your alos/tzeis)',
  },
  {
    formula: 'proportional_hours(4, custom(solar(16.1, before_visible_sunrise), solar(8.5, after_visible_sunset)))',
    description: 'Tefila using 16.1°/8.5° angle-based day',
  },
  {
    formula: 'sunset - 18min',
    description: 'Candle lighting - 18 min before sunset',
  },
  {
    formula: 'solar(8.5, after_visible_sunset)',
    description: 'Tzeis - 8.5° after sunset',
  },
  {
    formula: 'sunset + 72min',
    description: 'Tzeis - 72 minutes after sunset (Rabbeinu Tam)',
  },
];

// Helper to get all reference items
export function getAllReferenceItems(): ReferenceItem[] {
  return [...DSL_PRIMITIVES, ...DSL_FUNCTIONS, ...DSL_OPERATORS, ...DSL_CONDITIONALS, ...DSL_CONDITION_VARIABLES, ...DSL_DATE_LITERALS];
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
