/**
 * Error Humanizer - Transforms technical DSL errors into human-friendly messages
 * Epic 5, Story 5.1: Human-Friendly Error Messages
 */

export interface HumanError {
  headline: string;
  explanation?: string;
  suggestion: string;
  exampleCode?: string;
  referenceLink?: string;
  highlightRange?: { start: number; end: number };
}

interface ErrorPattern {
  pattern: RegExp;
  humanize: (match: RegExpMatchArray, formula: string) => HumanError;
}

// Function examples and parameter explanations
const FUNCTION_EXAMPLES: Record<string, string> = {
  solar: 'solar(16.1, before_visible_sunrise)',
  proportional_hours: 'proportional_hours(4, gra)',
  midpoint: 'midpoint(sunrise, sunset)',
  min: 'min(sunrise, @alos)',
  max: 'max(sunset, @tzeis)',
  first_valid: 'first_valid(solar(16.1, before_visible_sunrise), solar_midnight)',
  earlier_of: 'earlier_of(sunrise, @alos)',
  later_of: 'later_of(sunset, @tzeis)',
  if: 'if (is_friday) { sunset - 18min } else { sunset }',
};

const FUNCTION_PARAM_EXPLANATIONS: Record<string, string> = {
  solar: 'A number for degrees (0-90) AND a direction (before_visible_sunrise, after_visible_sunset, etc.)',
  proportional_hours: 'A number for hours (like 3 or 4) AND a base system (gra or mga)',
  midpoint: 'Two time values or references to find the middle point',
  min: 'Two time values - returns the earlier one',
  max: 'Two time values - returns the later one',
  first_valid: 'Two or more expressions - returns the first that produces a valid result',
  earlier_of: 'Two time values - returns the earlier one',
  later_of: 'Two time values - returns the later one',
  if: 'A condition, then a value if true, else a value if false',
};

// Known primitives for fuzzy matching
const KNOWN_PRIMITIVES = [
  'sunrise', 'sunset', 'solar_noon', 'midnight',
  'civil_dawn', 'civil_dusk', 'nautical_dawn', 'nautical_dusk',
  'astronomical_dawn', 'astronomical_dusk',
  'alos_hashachar', 'misheyakir', 'tzeis_hakochavim', 'chatzos',
];

// Known functions for fuzzy matching
const KNOWN_FUNCTIONS = [
  'solar', 'proportional_hours', 'midpoint', 'min', 'max', 'first_valid', 'earlier_of', 'later_of', 'if',
];

// Known directions
const KNOWN_DIRECTIONS = [
  'before_visible_sunrise', 'after_sunrise', 'before_sunset', 'after_visible_sunset',
  'before_noon', 'after_noon',
];

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find similar primitives to a given string
 */
function findSimilarPrimitives(input: string): string[] {
  const lowered = input.toLowerCase();
  const candidates = [...KNOWN_PRIMITIVES, ...KNOWN_FUNCTIONS];

  return candidates
    .map(p => ({ primitive: p, distance: levenshteinDistance(lowered, p) }))
    .filter(({ distance }) => distance <= 3)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .map(({ primitive }) => primitive);
}

/**
 * Find similar directions to a given string
 */
function findSimilarDirections(input: string): string[] {
  const lowered = input.toLowerCase();

  return KNOWN_DIRECTIONS
    .map(d => ({ direction: d, distance: levenshteinDistance(lowered, d) }))
    .filter(({ distance }) => distance <= 4)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 2)
    .map(({ direction }) => direction);
}

/**
 * Get example code for a function
 */
function getExampleForFunction(funcName: string): string {
  const lowered = funcName.toLowerCase();
  return FUNCTION_EXAMPLES[lowered] || `${funcName}(...)`;
}

/**
 * Get parameter explanation for a function
 */
function getParameterExplanation(funcName: string): string {
  const lowered = funcName.toLowerCase();
  return FUNCTION_PARAM_EXPLANATIONS[lowered] || 'Check the reference panel for parameter details.';
}

/**
 * Error patterns with their humanized transformations
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  // Syntax errors - missing parentheses
  {
    pattern: /unexpected token after expression[:\s]+(\w+)/i,
    humanize: (match) => {
      const token = match[1];
      const isFunction = KNOWN_FUNCTIONS.includes(token.toLowerCase());
      return {
        headline: `Oops! \`${token}\` needs parentheses to work.`,
        explanation: isFunction
          ? `${token}() is a function that needs arguments in parentheses.`
          : undefined,
        suggestion: isFunction
          ? `Try: ${getExampleForFunction(token)}`
          : `Try adding parentheses: ${token}(...)`,
        exampleCode: isFunction ? getExampleForFunction(token) : `${token}()`,
        referenceLink: '#functions',
      };
    },
  },

  // Missing arguments
  {
    pattern: /(\w+)\(\)[:\s]*requires\s+(\d+)\s+arguments?.*got\s+(\d+)/i,
    humanize: (match) => ({
      headline: `Almost there! \`${match[1]}()\` needs ${match[2]} things.`,
      explanation: getParameterExplanation(match[1]),
      suggestion: `Example: ${getExampleForFunction(match[1])}`,
      exampleCode: getExampleForFunction(match[1]),
      referenceLink: `#function-${match[1].toLowerCase()}`,
    }),
  },

  // Wrong number of arguments (too many or too few)
  {
    pattern: /expected\s+(\d+)\s+arguments?.*(?:got|found)\s+(\d+)/i,
    humanize: (match) => ({
      headline: `Expected ${match[1]} argument${parseInt(match[1]) !== 1 ? 's' : ''}, but found ${match[2]}.`,
      suggestion: 'Check the function signature in the reference panel.',
      referenceLink: '#functions',
    }),
  },

  // Value range errors - degrees too high
  {
    pattern: /degrees\s+must\s+be\s+between\s+0\s+and\s+90.*got\s+([\d.]+)/i,
    humanize: (match) => ({
      headline: `${match[1]}° is too high.`,
      explanation: 'The sun can only be 0-90° below the horizon.',
      suggestion: 'Common values: 8.5° (tzeis), 11° (misheyakir), 16.1° (alos), 18° (astronomical)',
      exampleCode: 'solar(16.1, before_visible_sunrise)',
    }),
  },

  // Value range errors - degrees too low
  {
    pattern: /degrees\s+must\s+be.*positive|negative\s+degrees/i,
    humanize: () => ({
      headline: 'Degrees must be positive.',
      explanation: 'Use a number between 0 and 90.',
      suggestion: 'Common values: 8.5° (tzeis), 11° (misheyakir), 16.1° (alos), 18° (astronomical)',
      exampleCode: 'solar(16.1, before_visible_sunrise)',
    }),
  },

  // Invalid direction
  {
    pattern: /invalid\s+direction[:\s]+(\w+)/i,
    humanize: (match) => {
      const similar = findSimilarDirections(match[1]);
      return {
        headline: `"${match[1]}" isn't a recognized direction.`,
        suggestion: similar.length > 0
          ? `Did you mean: ${similar.join(' or ')}?`
          : 'Choose: before_visible_sunrise, after_visible_sunset, before_noon, after_noon',
        exampleCode: 'solar(16.1, before_visible_sunrise)',
        referenceLink: '#directions',
      };
    },
  },

  // Unknown primitive
  {
    pattern: /unknown\s+primitive[:\s]+(\w+)/i,
    humanize: (match) => {
      const similar = findSimilarPrimitives(match[1]);
      return {
        headline: `I don't recognize "${match[1]}".`,
        suggestion: similar.length > 0
          ? `Did you mean: ${similar.join(', ')}?`
          : 'Check the primitives list in the reference panel.',
        referenceLink: '#primitives',
      };
    },
  },

  // Unknown function
  {
    pattern: /unknown\s+function[:\s]+(\w+)/i,
    humanize: (match) => {
      const similar = findSimilarPrimitives(match[1]);
      return {
        headline: `"${match[1]}" isn't a function I know.`,
        suggestion: similar.length > 0
          ? `Did you mean: ${similar.join(', ')}?`
          : 'Available functions: solar, proportional_hours, midpoint, min, max, first_valid, earlier_of, later_of',
        referenceLink: '#functions',
      };
    },
  },

  // Undefined reference
  {
    pattern: /undefined\s+reference[:\s]+@(\w+)/i,
    humanize: (match) => ({
      headline: `Can't find "@${match[1]}" in your zmanim.`,
      explanation: 'References must point to zmanim you\'ve already defined.',
      suggestion: 'Check your zman keys or use a primitive like sunrise.',
      referenceLink: '#references',
    }),
  },

  // Circular reference
  {
    pattern: /circular\s+reference/i,
    humanize: () => ({
      headline: 'This formula references itself!',
      explanation: 'A formula can\'t depend on its own result directly or through other formulas.',
      suggestion: 'Use a primitive like sunrise instead of a circular reference.',
      referenceLink: '#references',
    }),
  },

  // Cannot add times
  {
    pattern: /cannot\s+add\s+two\s+times|invalid.*addition/i,
    humanize: () => ({
      headline: 'You can\'t add times together.',
      explanation: 'You can add duration (like 30min) to a time, but not two times.',
      suggestion: 'To add minutes: time + 30min. To find middle: midpoint(time1, time2)',
      exampleCode: 'sunrise + 72min',
    }),
  },

  // Invalid time operation
  {
    pattern: /invalid\s+operation|cannot\s+(?:multiply|divide)\s+times?/i,
    humanize: () => ({
      headline: 'That operation isn\'t supported.',
      explanation: 'You can add/subtract minutes from times, but not multiply or divide.',
      suggestion: 'Use + or - with minutes: sunrise + 30min or sunset - 18min',
      exampleCode: 'sunset - 18min',
    }),
  },

  // Parsing error - generic syntax
  {
    pattern: /syntax\s+error|parse\s+error|unexpected\s+(?:end|token|character)/i,
    humanize: () => ({
      headline: 'Something isn\'t quite right with the syntax.',
      suggestion: 'Check for matching parentheses and proper formatting.',
      referenceLink: '#examples',
    }),
  },

  // Invalid minutes format
  {
    pattern: /invalid\s+(?:minutes?|duration)\s+format/i,
    humanize: () => ({
      headline: 'Minutes should be written like "30min".',
      suggestion: 'Format: number followed by "min". Example: sunrise + 72min',
      exampleCode: 'sunrise + 72min',
    }),
  },

  // Missing operator
  {
    pattern: /missing\s+operator|expected\s+operator/i,
    humanize: () => ({
      headline: 'Missing an operator (+, -, etc.).',
      suggestion: 'Connect values with + or - operators.',
      exampleCode: 'sunrise + 30min',
    }),
  },

  // Invalid proportional hours base
  {
    pattern: /invalid\s+(?:base|system)[:\s]+(\w+)/i,
    humanize: (match) => ({
      headline: `"${match[1]}" isn't a recognized base system.`,
      explanation: 'The base system determines how to calculate proportional hours.',
      suggestion: 'Choose: gra (sunrise-sunset) or mga (dawn-nightfall)',
      exampleCode: 'proportional_hours(4, gra)',
      referenceLink: '#proportional-hours',
    }),
  },
];

/**
 * Transform a backend error message into a human-friendly error object
 */
export function humanizeError(backendError: string, formula: string = ''): HumanError {
  // Check if backend already provided a suggestion
  const suggestionMatch = backendError.match(/suggestion:\s*(.+)/i);
  if (suggestionMatch) {
    return {
      headline: backendError.replace(/suggestion:\s*.+/i, '').trim(),
      suggestion: suggestionMatch[1],
    };
  }

  // Try to match against known patterns
  for (const { pattern, humanize } of ERROR_PATTERNS) {
    const match = backendError.match(pattern);
    if (match) {
      return humanize(match, formula);
    }
  }

  // Fallback for unrecognized errors
  return {
    headline: 'Something isn\'t quite right.',
    explanation: backendError.length < 200 ? backendError : undefined,
    suggestion: 'Check your formula against the examples in the reference panel.',
    referenceLink: '#examples',
  };
}

/**
 * Check if an error message can be humanized (for testing)
 */
export function canHumanize(errorMessage: string): boolean {
  return ERROR_PATTERNS.some(({ pattern }) => pattern.test(errorMessage));
}

/**
 * Get all known error patterns (for testing)
 */
export function getErrorPatterns(): RegExp[] {
  return ERROR_PATTERNS.map(({ pattern }) => pattern);
}
