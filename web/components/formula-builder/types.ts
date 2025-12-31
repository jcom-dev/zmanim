// Formula builder state and types

export type MethodType = 'solar' | 'fixed' | 'proportional' | 'fixed_zman' | null;
export type SolarDirection = 'before_visible_sunrise' | 'after_visible_sunset' | 'before_noon' | 'after_noon';
export type OffsetDirection = 'before' | 'after';
// UI-exposed base options (commonly used)
export type ShaosBase = 'gra' | 'mga' | 'mga_90' | 'baal_hatanya' | 'custom';

// All backend-supported bases (for parsing existing formulas)
export type ShaosBaseExtended =
  | ShaosBase
  | 'mga_60' | 'mga_72' | 'mga_96' | 'mga_120'
  | 'mga_72_zmanis' | 'mga_90_zmanis' | 'mga_96_zmanis'
  | 'mga_16_1' | 'mga_18' | 'mga_19_8' | 'mga_26';

// Complexity reasons for formulas that can't be represented in guided builder
export type ComplexityReason =
  | 'conditional'        // if/else statements
  | 'midpoint'           // midpoint() function
  | 'chained_operations' // multiple +/- operations
  | 'unknown_function'   // unrecognized function
  | 'unknown_syntax';    // catch-all

export interface FormulaBuilderState {
  // Base time selection
  baseTime: string;

  // Selected method
  method: MethodType;

  // Fixed zman selection
  selectedFixedZman: string;

  // Solar angle parameters
  solarDegrees: number;
  solarDirection: SolarDirection;

  // Fixed offset parameters
  offsetMinutes: number;
  offsetDirection: OffsetDirection;
  offsetBase: string;
  offsetBaseIsZman: boolean; // true if base is a zman reference (needs @ prefix)

  // Proportional hours parameters
  shaosHours: number;
  shaosBase: ShaosBase;
  customStart?: string;
  customEnd?: string;

  // Derived state
  generatedFormula: string;
  validationErrors: string[];
  isValid: boolean;
}

export const initialState: FormulaBuilderState = {
  baseTime: 'visible_sunrise',
  method: null,
  selectedFixedZman: 'visible_sunrise',
  solarDegrees: 16.1,
  solarDirection: 'before_visible_sunrise',
  offsetMinutes: 72,
  offsetDirection: 'before',
  offsetBase: 'visible_sunrise',
  offsetBaseIsZman: false,
  shaosHours: 3,
  shaosBase: 'gra',
  generatedFormula: 'visible_sunrise',
  validationErrors: [],
  isValid: true,
};

// Fixed zmanim - pure astronomical events requiring no calculation parameters
export const fixedZmanimOptions = [
  {
    label: 'Day',
    options: [
      { value: 'visible_sunrise', label: 'Visible Sunrise', description: 'Sun crosses horizon (morning)' },
      { value: 'solar_noon', label: 'Solar Noon', description: 'Sun at highest point' },
      { value: 'visible_sunset', label: 'Visible Sunset', description: 'Sun crosses horizon (evening)' },
    ],
  },
  {
    label: 'Night',
    options: [
      { value: 'solar_midnight', label: 'Solar Midnight', description: 'Solar midnight' },
    ],
  },
];

// Base time primitives organized by category (used in Fixed Offset method)
export const baseTimeOptions = [
  {
    label: 'Dawn',
    options: [
      { value: 'alos_hashachar', label: 'Alos HaShachar', description: 'Dawn (72 min before sunrise)' },
      { value: 'misheyakir', label: 'Misheyakir', description: 'Earliest tallis/tefillin' },
    ],
  },
  {
    label: 'Day',
    options: [
      { value: 'visible_sunrise', label: 'Visible Sunrise', description: 'Netz HaChama' },
      { value: 'solar_noon', label: 'Solar Noon', description: 'Chatzos HaYom' },
    ],
  },
  {
    label: 'Dusk',
    options: [
      { value: 'visible_sunset', label: 'Visible Sunset', description: 'Shkias HaChama' },
      { value: 'bein_hashmashos', label: 'Bein HaShmashos', description: 'Between the suns' },
    ],
  },
  {
    label: 'Night',
    options: [
      { value: 'tzeis_hakochavim', label: 'Tzeis HaKochavim', description: 'Nightfall (stars visible)' },
      { value: 'solar_midnight', label: 'Solar Midnight', description: 'Chatzos HaLailah' },
    ],
  },
];

// Common solar angle presets
export const solarAnglePresets = [
  { value: 16.1, label: '16.1°', description: 'Standard dawn/dusk' },
  { value: 18, label: '18°', description: 'Astronomical twilight' },
  { value: 19.8, label: '19.8°', description: '90 minute equivalent' },
  { value: 26, label: '26°', description: 'R\' Tam (72 equinox minutes)' },
];

// Generate DSL formula from state
export function generateFormula(state: FormulaBuilderState): string {
  if (!state.method) {
    return state.baseTime;
  }

  switch (state.method) {
    case 'solar':
      return `solar(${state.solarDegrees}, ${state.solarDirection})`;

    case 'fixed': {
      const op = state.offsetDirection === 'before' ? '-' : '+';
      const base = state.offsetBaseIsZman ? `@${state.offsetBase}` : state.offsetBase;
      return `${base} ${op} ${state.offsetMinutes}min`;
    }

    case 'proportional':
      if (state.shaosBase === 'custom' && state.customStart && state.customEnd) {
        return `proportional_hours(${state.shaosHours}, custom(@${state.customStart}, @${state.customEnd}))`;
      }
      return `proportional_hours(${state.shaosHours}, ${state.shaosBase})`;

    case 'fixed_zman':
      return state.selectedFixedZman;

    default:
      return state.baseTime;
  }
}

// Parse result type
export interface ParseResult {
  success: boolean;
  state?: Partial<FormulaBuilderState>;
  error?: string;
  complexityReason?: ComplexityReason;
  complexityDetails?: string; // Human-readable explanation for tooltip/banner
}

// Parse a DSL formula back into builder state
export function parseFormula(formula: string): ParseResult {
  if (!formula || !formula.trim()) {
    return { success: false, error: 'Empty formula' };
  }

  const trimmed = formula.trim();

  // 1. Check for solar angle: solar(degrees, direction)
  const solarMatch = trimmed.match(/^solar\s*\(\s*([\d.]+)\s*,\s*(before_visible_sunrise|after_visible_sunset|before_noon|after_noon)\s*\)$/);
  if (solarMatch) {
    return {
      success: true,
      state: {
        method: 'solar',
        solarDegrees: parseFloat(solarMatch[1]),
        solarDirection: solarMatch[2] as SolarDirection,
      },
    };
  }

  // 2. Check for proportional hours: proportional_hours(hours, base)
  // UI supports: gra, mga, mga_90, baal_hatanya, custom
  const proportionalMatch = trimmed.match(/^proportional_hours\s*\(\s*([\d.]+)\s*,\s*(gra|mga|mga_90|baal_hatanya)\s*\)$/);
  if (proportionalMatch) {
    return {
      success: true,
      state: {
        method: 'proportional',
        shaosHours: parseFloat(proportionalMatch[1]),
        shaosBase: proportionalMatch[2] as ShaosBase,
      },
    };
  }

  // Check for advanced MGA variants - valid but not editable in visual builder
  const advancedMgaMatch = trimmed.match(/^proportional_hours\s*\(\s*[\d.]+\s*,\s*(mga_60|mga_72|mga_96|mga_120|mga_72_zmanis|mga_90_zmanis|mga_96_zmanis|mga_16_1|mga_18|mga_19_8|mga_26)\s*\)$/);
  if (advancedMgaMatch) {
    return {
      success: false,
      error: `Advanced MGA variant "${advancedMgaMatch[1]}" requires Advanced DSL mode.`,
      complexityReason: 'unknown_syntax',
      complexityDetails: `This formula uses an advanced MGA variant. Use Custom mode or Advanced DSL to specify custom day boundaries.`,
    };
  }

  // Check for custom proportional_hours: proportional_hours(hours, custom(@start, @end))
  const proportionalCustomMatch = trimmed.match(/^proportional_hours\s*\(\s*([\d.]+)\s*,\s*custom\s*\(\s*@([a-z_][a-z0-9_]*)\s*,\s*@([a-z_][a-z0-9_]*)\s*\)\s*\)$/i);
  if (proportionalCustomMatch) {
    return {
      success: true,
      state: {
        method: 'proportional',
        shaosHours: parseFloat(proportionalCustomMatch[1]),
        shaosBase: 'custom',
        customStart: proportionalCustomMatch[2],
        customEnd: proportionalCustomMatch[3],
      },
    };
  }

  // Check for proportional_minutes - valid but requires Advanced DSL mode
  if (/^proportional_minutes\s*\(/.test(trimmed)) {
    return {
      success: false,
      error: 'proportional_minutes requires Advanced DSL mode.',
      complexityReason: 'unknown_function',
      complexityDetails: 'The proportional_minutes function is not available in the guided builder. Use Advanced DSL mode to edit this formula.',
    };
  }

  // 3. Check for fixed offset: base +/- Nmin
  // Matches: "sunrise - 72min", "@some_zman + 18min", "sunset - 40min"
  const offsetMatch = trimmed.match(/^(@?[a-z_][a-z0-9_]*)\s*([+-])\s*(\d+)\s*min$/i);
  if (offsetMatch) {
    const hasAtPrefix = offsetMatch[1].startsWith('@');
    return {
      success: true,
      state: {
        method: 'fixed',
        offsetBase: offsetMatch[1].replace(/^@/, ''), // Remove @ prefix if present
        offsetBaseIsZman: hasAtPrefix, // Track if original had @ prefix
        offsetDirection: offsetMatch[2] === '-' ? 'before' : 'after',
        offsetMinutes: parseInt(offsetMatch[3], 10),
      },
    };
  }

  // 4. Check for fixed zman (simple variable name)
  // Must be a valid identifier: sunrise, sunset, solar_noon, midnight, or @zman_key
  const fixedZmanMatch = trimmed.match(/^@?([a-z_][a-z0-9_]*)$/i);
  if (fixedZmanMatch) {
    const zmanName = fixedZmanMatch[1];
    // Check if it's a known primitive
    const knownPrimitives = [
      // Full primitive names - visible horizon events
      'visible_sunrise', 'visible_sunset',
      // Geometric horizon events
      'geometric_sunrise', 'geometric_sunset',
      // Solar position events
      'solar_noon', 'solar_midnight',
      // Civil twilight
      'civil_dawn', 'civil_dusk',
      // Nautical twilight
      'nautical_dawn', 'nautical_dusk',
      // Astronomical twilight
      'astronomical_dawn', 'astronomical_dusk',
      // For midnight reference
      'midnight'
    ];
    if (knownPrimitives.includes(zmanName) || trimmed.startsWith('@')) {
      return {
        success: true,
        state: {
          method: 'fixed_zman',
          selectedFixedZman: zmanName,
        },
      };
    }
  }

  // 5. Detect specific complexity reasons before generic fallback

  // Check for conditionals (if/else)
  if (/\bif\s*\(/.test(trimmed) || /\belse\b/.test(trimmed)) {
    return {
      success: false,
      error: 'Conditional logic (if/else) requires Advanced DSL mode.',
      complexityReason: 'conditional',
      complexityDetails: 'This formula uses conditional logic to choose between different calculations based on date, location, or other factors.',
    };
  }

  // Check for midpoint function
  if (/\bmidpoint\s*\(/.test(trimmed)) {
    return {
      success: false,
      error: 'Midpoint calculations require Advanced DSL mode.',
      complexityReason: 'midpoint',
      complexityDetails: 'This formula calculates the midpoint between two times, which the visual builder cannot represent.',
    };
  }

  // Check for chained operations (multiple +/- with min)
  const operatorMatches = trimmed.match(/[+-]\s*\d+\s*min/g);
  if (operatorMatches && operatorMatches.length > 1) {
    return {
      success: false,
      error: 'Chained operations require Advanced DSL mode.',
      complexityReason: 'chained_operations',
      complexityDetails: 'This formula applies multiple offsets in sequence. Use the Advanced editor for multi-step calculations.',
    };
  }

  // Check for unknown functions (functions other than solar, seasonal_solar, proportional_hours, proportional_minutes, custom)
  const functionMatches = trimmed.match(/\b([a-z_][a-z0-9_]*)\s*\(/gi);
  if (functionMatches) {
    const knownFunctions = ['solar', 'seasonal_solar', 'proportional_hours', 'proportional_minutes', 'custom'];
    for (const match of functionMatches) {
      const funcName = match.replace(/\s*\($/, '').toLowerCase();
      if (!knownFunctions.includes(funcName)) {
        return {
          success: false,
          error: `Unknown function "${funcName}" requires Advanced DSL mode.`,
          complexityReason: 'unknown_function',
          complexityDetails: `The function "${funcName}" is not available in the guided builder. Use Advanced DSL mode to edit this formula.`,
        };
      }
    }
  }

  // 6. Generic fallback - formula is too complex for guided builder
  return {
    success: false,
    error: 'This formula uses advanced syntax that cannot be edited in Guided Builder mode.',
    complexityReason: 'unknown_syntax',
    complexityDetails: 'This formula uses syntax that the visual builder cannot represent. Use Advanced DSL mode to edit.',
  };
}
