/**
 * DSL Context Helper - Detects cursor context in DSL formulas
 * Epic 5, Story 5.2: Contextual Tooltips in DSL Editor
 */

export type DSLContext =
  | { type: 'empty_editor' }
  | { type: 'solar_degrees'; position: number; paramStart: number; paramEnd: number }
  | { type: 'solar_direction'; position: number; paramStart: number; paramEnd: number }
  | { type: 'proportional_hours'; position: number; paramStart: number; paramEnd: number }
  | { type: 'proportional_base'; position: number; paramStart: number; paramEnd: number }
  | { type: 'proportional_minutes'; position: number; paramStart: number; paramEnd: number }
  | { type: 'midpoint_first'; position: number; paramStart: number; paramEnd: number }
  | { type: 'midpoint_second'; position: number; paramStart: number; paramEnd: number }
  | { type: 'min_max_first'; position: number; func: 'min' | 'max'; paramStart: number; paramEnd: number }
  | { type: 'min_max_second'; position: number; func: 'min' | 'max'; paramStart: number; paramEnd: number }
  | { type: 'first_valid_param'; position: number; paramStart: number; paramEnd: number }
  | { type: 'earlier_of_first'; position: number; paramStart: number; paramEnd: number }
  | { type: 'earlier_of_second'; position: number; paramStart: number; paramEnd: number }
  | { type: 'later_of_first'; position: number; paramStart: number; paramEnd: number }
  | { type: 'later_of_second'; position: number; paramStart: number; paramEnd: number }
  | { type: 'reference'; position: number; paramStart: number; paramEnd: number }
  | { type: 'primitive' }
  | { type: 'operator'; afterValue: boolean }
  | { type: 'unknown' };

/**
 * Count open/close parentheses to find nesting level
 */
function countParens(text: string): { open: number; close: number } {
  let open = 0;
  let close = 0;
  for (const char of text) {
    if (char === '(') open++;
    if (char === ')') close++;
  }
  return { open, close };
}

/**
 * Find the innermost function context at cursor position
 */
function findInnermostFunction(formula: string, cursorPos: number): {
  funcName: string;
  paramIndex: number;
  funcStart: number;
  paramStart: number;
  paramEnd: number;
} | null {
  const beforeCursor = formula.slice(0, cursorPos);

  // Track parenthesis depth and find the last open function
  let depth = 0;
  let commaCount = 0;

  // Scan backwards from cursor to find our function context
  for (let i = beforeCursor.length - 1; i >= 0; i--) {
    const char = beforeCursor[i];

    if (char === ')') {
      depth++;
    } else if (char === '(') {
      if (depth > 0) {
        depth--;
      } else {
        // This is our opening paren - look for function name before it
        const textBefore = beforeCursor.slice(0, i);
        const funcMatch = textBefore.match(/(\w+)\s*$/);
        if (funcMatch) {
          const funcName = funcMatch[1].toLowerCase();
          // Count commas between this paren and cursor (at our level)
          const textAfterParen = beforeCursor.slice(i + 1);
          commaCount = 0;
          let nestedDepth = 0;
          let lastCommaOrParenPos = i; // Position of opening paren or last comma at our level
          for (let j = 0; j < textAfterParen.length; j++) {
            const c = textAfterParen[j];
            if (c === '(') nestedDepth++;
            else if (c === ')') nestedDepth--;
            else if (c === ',' && nestedDepth === 0) {
              commaCount++;
              lastCommaOrParenPos = i + 1 + j; // Update to comma position
            }
          }

          // paramStart is after the opening paren or comma (skip leading whitespace)
          let paramStart = lastCommaOrParenPos + 1;
          while (paramStart < cursorPos && /\s/.test(formula[paramStart])) {
            paramStart++;
          }

          // paramEnd is before closing paren or next comma (scan forward from cursor)
          let paramEnd = cursorPos;
          nestedDepth = 0;
          for (let j = cursorPos; j < formula.length; j++) {
            const c = formula[j];
            if (c === '(') nestedDepth++;
            else if (c === ')') {
              if (nestedDepth > 0) nestedDepth--;
              else { paramEnd = j; break; }
            }
            else if (c === ',' && nestedDepth === 0) {
              paramEnd = j;
              break;
            }
          }
          // Trim trailing whitespace from paramEnd
          while (paramEnd > paramStart && /\s/.test(formula[paramEnd - 1])) {
            paramEnd--;
          }

          return { funcName, paramIndex: commaCount, funcStart: i - funcMatch[1].length, paramStart, paramEnd };
        }
        return null;
      }
    }
  }

  return null;
}

/**
 * Get DSL context based on cursor position
 */
export function getDSLContext(formula: string, cursorPos: number): DSLContext {
  // Empty editor
  if (!formula.trim()) {
    return { type: 'empty_editor' };
  }

  const beforeCursor = formula.slice(0, cursorPos);

  // Check if we're typing a reference (@...)
  const refMatch = beforeCursor.match(/@\w*$/);
  if (refMatch) {
    const refStart = cursorPos - refMatch[0].length;
    // Find end of reference (continue while word chars)
    let refEnd = cursorPos;
    while (refEnd < formula.length && /\w/.test(formula[refEnd])) {
      refEnd++;
    }
    return { type: 'reference', position: cursorPos, paramStart: refStart, paramEnd: refEnd };
  }

  // Find innermost function context
  const funcContext = findInnermostFunction(formula, cursorPos);

  if (funcContext) {
    const { funcName, paramIndex, paramStart, paramEnd } = funcContext;

    // solar(degrees, direction)
    if (funcName === 'solar') {
      if (paramIndex === 0) {
        return { type: 'solar_degrees', position: cursorPos, paramStart, paramEnd };
      } else if (paramIndex === 1) {
        return { type: 'solar_direction', position: cursorPos, paramStart, paramEnd };
      }
    }

    // proportional_hours(hours, base)
    if (funcName === 'proportional_hours') {
      if (paramIndex === 0) {
        return { type: 'proportional_hours', position: cursorPos, paramStart, paramEnd };
      } else if (paramIndex === 1) {
        return { type: 'proportional_base', position: cursorPos, paramStart, paramEnd };
      }
    }

    // proportional_minutes(minutes, base)
    if (funcName === 'proportional_minutes') {
      if (paramIndex === 0) {
        return { type: 'proportional_minutes', position: cursorPos, paramStart, paramEnd };
      } else if (paramIndex === 1) {
        return { type: 'proportional_base', position: cursorPos, paramStart, paramEnd };
      }
    }

    // midpoint(time1, time2)
    if (funcName === 'midpoint') {
      if (paramIndex === 0) {
        return { type: 'midpoint_first', position: cursorPos, paramStart, paramEnd };
      } else if (paramIndex === 1) {
        return { type: 'midpoint_second', position: cursorPos, paramStart, paramEnd };
      }
    }

    // min(time1, time2) or max(time1, time2)
    if (funcName === 'min' || funcName === 'max') {
      if (paramIndex === 0) {
        return { type: 'min_max_first', position: cursorPos, func: funcName, paramStart, paramEnd };
      } else if (paramIndex === 1) {
        return { type: 'min_max_second', position: cursorPos, func: funcName, paramStart, paramEnd };
      }
    }

    // first_valid(expr1, expr2, ...)
    if (funcName === 'first_valid') {
      return { type: 'first_valid_param', position: cursorPos, paramStart, paramEnd };
    }

    // earlier_of(time1, time2)
    if (funcName === 'earlier_of') {
      if (paramIndex === 0) {
        return { type: 'earlier_of_first', position: cursorPos, paramStart, paramEnd };
      } else if (paramIndex === 1) {
        return { type: 'earlier_of_second', position: cursorPos, paramStart, paramEnd };
      }
    }

    // later_of(time1, time2)
    if (funcName === 'later_of') {
      if (paramIndex === 0) {
        return { type: 'later_of_first', position: cursorPos, paramStart, paramEnd };
      } else if (paramIndex === 1) {
        return { type: 'later_of_second', position: cursorPos, paramStart, paramEnd };
      }
    }
  }

  // Check if we're after a value (might want operator)
  const afterValue = beforeCursor.match(/(\w+|\d+min?|\))\s*$/);
  if (afterValue) {
    return { type: 'operator', afterValue: true };
  }

  return { type: 'unknown' };
}

/**
 * Get context-specific tooltip data
 */
export interface TooltipOption {
  value: string;
  label: string;
  description?: string;
  hebrewDescription?: string;
}

export interface TooltipData {
  title: string;
  description?: string;
  options: TooltipOption[];
  hint?: string;
  allowCustomInput?: boolean;
}

export const TOOLTIP_CONTENT: Record<string, TooltipData> = {
  solar_degrees: {
    title: '📐 Degrees: Sun angle below horizon (0-90)',
    description: 'How far below the horizon is the sun?',
    options: [
      { value: '8.5', label: '8.5°', description: 'Tzeis (nightfall)', hebrewDescription: 'צאת הכוכבים' },
      { value: '11', label: '11°', description: 'Misheyakir (tallis/tefillin)', hebrewDescription: 'משיכיר' },
      { value: '16.1', label: '16.1°', description: 'Alos (Magen Avraham dawn)', hebrewDescription: 'עלות השחר' },
      { value: '18', label: '18°', description: 'Astronomical twilight' },
      { value: '7.083', label: '7.083°', description: 'Tzeis 3 stars (Geonim)' },
    ],
    hint: 'Type a number, e.g., 16.1',
    allowCustomInput: true,
  },
  solar_direction: {
    title: '🧭 Direction: When does this angle occur?',
    description: 'Select when the sun angle occurs.',
    options: [
      { value: 'before_visible_sunrise', label: 'before_visible_sunrise', description: 'Morning (dawn) - sun ascending before sunrise' },
      { value: 'after_visible_sunset', label: 'after_visible_sunset', description: 'Evening (tzeis) - sun descending after sunset' },
      { value: 'before_noon', label: 'before_noon', description: 'Late morning - sun ascending before solar noon' },
      { value: 'after_noon', label: 'after_noon', description: 'Afternoon - sun descending after solar noon' },
    ],
  },
  proportional_hours: {
    title: '⏰ Proportional Hours: Which halachic hour?',
    description: 'The day is divided into 12 proportional hours.',
    options: [
      { value: '3', label: '3 hours', description: 'Latest Shema', hebrewDescription: 'סוף זמן קריאת שמע' },
      { value: '4', label: '4 hours', description: 'Latest Shacharis', hebrewDescription: 'סוף זמן תפילה' },
      { value: '6', label: '6 hours', description: 'Chatzos (midday)', hebrewDescription: 'חצות' },
      { value: '6.5', label: '6.5 hours', description: 'Mincha Gedola' },
      { value: '9.5', label: '9.5 hours', description: 'Mincha Ketana' },
      { value: '10.75', label: '10.75 hours', description: 'Plag HaMincha' },
    ],
    hint: 'Type a number, e.g., 4',
    allowCustomInput: true,
  },
  proportional_base: {
    title: '📏 Base System: How is the day calculated?',
    description: 'Different authorities define day boundaries differently.',
    options: [
      { value: 'gra', label: 'gra', description: 'GRA (Vilna Gaon): sunrise to sunset' },
      { value: 'mga', label: 'mga', description: 'MGA: 72 min before sunrise to 72 min after sunset' },
      { value: 'mga_60', label: 'mga_60', description: 'MGA 60: 60 min before/after' },
      { value: 'mga_72', label: 'mga_72', description: 'MGA 72: 72 min before/after (same as mga)' },
      { value: 'mga_90', label: 'mga_90', description: 'MGA 90: 90 min before/after' },
      { value: 'mga_96', label: 'mga_96', description: 'MGA 96: 96 min before/after' },
      { value: 'mga_120', label: 'mga_120', description: 'MGA 120: 120 min before/after' },
      { value: 'mga_72_zmanis', label: 'mga_72_zmanis', description: 'MGA 72 zmaniyos: 1/10th of day before/after' },
      { value: 'mga_90_zmanis', label: 'mga_90_zmanis', description: 'MGA 90 zmaniyos: 1/8th of day before/after' },
      { value: 'mga_96_zmanis', label: 'mga_96_zmanis', description: 'MGA 96 zmaniyos: 1/7.5th of day before/after' },
      { value: 'mga_16_1', label: 'mga_16_1', description: 'MGA 16.1°: 16.1° alos to 16.1° tzais' },
      { value: 'mga_18', label: 'mga_18', description: 'MGA 18°: 18° alos to 18° tzais (astronomical twilight)' },
      { value: 'mga_19_8', label: 'mga_19_8', description: 'MGA 19.8°: 19.8° alos to 19.8° tzais' },
      { value: 'mga_26', label: 'mga_26', description: 'MGA 26°: 26° alos to 26° tzais' },
      { value: 'baal_hatanya', label: 'baal_hatanya', description: 'Baal HaTanya: 1.583° below horizon' },
      { value: 'ateret_torah', label: 'ateret_torah', description: 'Ateret Torah: sunrise to tzeis 40 min (Sephardic)' },
      { value: 'custom(@alos, @tzeis)', label: 'custom(...)', description: 'Define your own day boundaries' },
    ],
    hint: 'Use custom(start, end) for arbitrary boundaries',
  },
  proportional_minutes: {
    title: '⏰ Proportional Minutes: How many minutes?',
    description: 'Minutes are stretched/compressed based on the day length.',
    options: [
      { value: '18', label: '18 min', description: 'Common candle lighting time' },
      { value: '40', label: '40 min', description: 'Tzeis for some opinions' },
      { value: '72', label: '72 min', description: 'MGA alos/tzeis' },
      { value: '90', label: '90 min', description: 'Extended dawn/dusk' },
      { value: '120', label: '120 min', description: 'Very early/late times' },
    ],
    hint: 'Type a number, e.g., 72',
    allowCustomInput: true,
  },
  midpoint_first: {
    title: '📍 First Time: Starting point',
    description: 'The earlier time to find the midpoint.',
    options: [
      { value: 'visible_sunrise', label: 'visible_sunrise', description: 'Visible sunrise (with refraction)' },
      { value: '@alos', label: '@alos', description: 'Reference to your alos' },
      { value: 'solar(16.1, before_visible_sunrise)', label: 'solar(16.1, before_visible_sunrise)', description: 'Alos at 16.1°' },
    ],
    hint: 'Use a primitive or reference',
  },
  midpoint_second: {
    title: '📍 Second Time: Ending point',
    description: 'The later time to find the midpoint.',
    options: [
      { value: 'visible_sunset', label: 'visible_sunset', description: 'Visible sunset (with refraction)' },
      { value: '@tzeis', label: '@tzeis', description: 'Reference to your tzeis' },
      { value: 'solar(8.5, after_visible_sunset)', label: 'solar(8.5, after_visible_sunset)', description: 'Tzeis at 8.5°' },
    ],
    hint: 'Use a primitive or reference',
  },
  min_max_first: {
    title: '⏱️ First Time',
    description: 'First time to compare.',
    options: [
      { value: 'visible_sunrise', label: 'visible_sunrise', description: 'Visible sunrise (with refraction)' },
      { value: 'visible_sunset', label: 'visible_sunset', description: 'Visible sunset (with refraction)' },
      { value: '@alos', label: '@alos', description: 'Reference to alos' },
      { value: '@tzeis', label: '@tzeis', description: 'Reference to tzeis' },
    ],
  },
  min_max_second: {
    title: '⏱️ Second Time',
    description: 'Second time to compare.',
    options: [
      { value: 'visible_sunrise', label: 'visible_sunrise', description: 'Visible sunrise (with refraction)' },
      { value: 'visible_sunset', label: 'visible_sunset', description: 'Visible sunset (with refraction)' },
      { value: '@alos', label: '@alos', description: 'Reference to alos' },
      { value: '@tzeis', label: '@tzeis', description: 'Reference to tzeis' },
    ],
  },
  first_valid_param: {
    title: '🔄 Fallback Value',
    description: 'Provide fallback values in case earlier values are null or error.',
    options: [
      { value: 'visible_sunrise', label: 'visible_sunrise', description: 'Visible sunrise (with refraction)' },
      { value: 'visible_sunset', label: 'visible_sunset', description: 'Visible sunset (with refraction)' },
      { value: 'solar_noon', label: 'solar_noon', description: 'Solar noon' },
      { value: 'solar_midnight', label: 'solar_midnight', description: 'Solar midnight' },
    ],
    hint: 'First non-null/non-error value is returned',
  },
  earlier_of_first: {
    title: '⏱️ First Time',
    description: 'First time to compare (returns the earlier of the two).',
    options: [
      { value: 'visible_sunrise', label: 'visible_sunrise', description: 'Visible sunrise (with refraction)' },
      { value: 'visible_sunset', label: 'visible_sunset', description: 'Visible sunset (with refraction)' },
      { value: '@alos', label: '@alos', description: 'Reference to alos' },
      { value: '@tzeis', label: '@tzeis', description: 'Reference to tzeis' },
    ],
  },
  earlier_of_second: {
    title: '⏱️ Second Time',
    description: 'Second time to compare (returns the earlier of the two).',
    options: [
      { value: 'visible_sunrise', label: 'visible_sunrise', description: 'Visible sunrise (with refraction)' },
      { value: 'visible_sunset', label: 'visible_sunset', description: 'Visible sunset (with refraction)' },
      { value: '@alos', label: '@alos', description: 'Reference to alos' },
      { value: '@tzeis', label: '@tzeis', description: 'Reference to tzeis' },
    ],
  },
  later_of_first: {
    title: '⏱️ First Time',
    description: 'First time to compare (returns the later of the two).',
    options: [
      { value: 'visible_sunrise', label: 'visible_sunrise', description: 'Visible sunrise (with refraction)' },
      { value: 'visible_sunset', label: 'visible_sunset', description: 'Visible sunset (with refraction)' },
      { value: '@alos', label: '@alos', description: 'Reference to alos' },
      { value: '@tzeis', label: '@tzeis', description: 'Reference to tzeis' },
    ],
  },
  later_of_second: {
    title: '⏱️ Second Time',
    description: 'Second time to compare (returns the later of the two).',
    options: [
      { value: 'visible_sunrise', label: 'visible_sunrise', description: 'Visible sunrise (with refraction)' },
      { value: 'visible_sunset', label: 'visible_sunset', description: 'Visible sunset (with refraction)' },
      { value: '@alos', label: '@alos', description: 'Reference to alos' },
      { value: '@tzeis', label: '@tzeis', description: 'Reference to tzeis' },
    ],
  },
  empty_editor: {
    title: '✨ Start your formula',
    description: 'Click an example to get started:',
    options: [
      { value: 'visible_sunrise - 72min', label: 'visible_sunrise - 72min', description: 'Fixed time before sunrise' },
      { value: 'solar(16.1, before_visible_sunrise)', label: 'solar(16.1, ...)', description: 'Dawn at 16.1°' },
      { value: 'proportional_hours(4, gra)', label: 'proportional_hours(4, ...)', description: 'Latest Shacharis' },
      { value: 'visible_sunset - 18min', label: 'visible_sunset - 18min', description: 'Candle lighting' },
    ],
    hint: 'Or pick from the reference panel →',
  },
};

/**
 * Get tooltip data for a given context type
 */
export function getTooltipData(context: DSLContext): TooltipData | null {
  if (context.type === 'empty_editor') {
    return TOOLTIP_CONTENT.empty_editor;
  }

  if (context.type === 'solar_degrees') {
    return TOOLTIP_CONTENT.solar_degrees;
  }

  if (context.type === 'solar_direction') {
    return TOOLTIP_CONTENT.solar_direction;
  }

  if (context.type === 'proportional_hours') {
    return TOOLTIP_CONTENT.proportional_hours;
  }

  if (context.type === 'proportional_base') {
    return TOOLTIP_CONTENT.proportional_base;
  }

  if (context.type === 'proportional_minutes') {
    return TOOLTIP_CONTENT.proportional_minutes;
  }

  if (context.type === 'midpoint_first') {
    return TOOLTIP_CONTENT.midpoint_first;
  }

  if (context.type === 'midpoint_second') {
    return TOOLTIP_CONTENT.midpoint_second;
  }

  if (context.type === 'min_max_first') {
    return TOOLTIP_CONTENT.min_max_first;
  }

  if (context.type === 'min_max_second') {
    return TOOLTIP_CONTENT.min_max_second;
  }

  if (context.type === 'first_valid_param') {
    return TOOLTIP_CONTENT.first_valid_param;
  }

  if (context.type === 'earlier_of_first') {
    return TOOLTIP_CONTENT.earlier_of_first;
  }

  if (context.type === 'earlier_of_second') {
    return TOOLTIP_CONTENT.earlier_of_second;
  }

  if (context.type === 'later_of_first') {
    return TOOLTIP_CONTENT.later_of_first;
  }

  if (context.type === 'later_of_second') {
    return TOOLTIP_CONTENT.later_of_second;
  }

  return null;
}
