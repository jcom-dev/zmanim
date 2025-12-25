/**
 * Custom DSL Language Support for CodeMirror 6
 * Provides syntax highlighting for the Zmanim DSL
 */

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { StreamLanguage } from '@codemirror/language';

// DSL Keywords and tokens
export const DSL_PRIMITIVES = new Set([
  'visible_sunrise', 'visible_sunset',
  'solar_noon', 'solar_midnight',
  'geometric_sunrise', 'geometric_sunset',
  'civil_dawn', 'civil_dusk', 'nautical_dawn', 'nautical_dusk',
  'astronomical_dawn', 'astronomical_dusk',
]);

export const DSL_FUNCTIONS = new Set([
  'solar', 'seasonal_solar', 'proportional_hours', 'proportional_minutes', 'midpoint', 'first_valid', 'earlier_of', 'later_of',
]);

export const DSL_KEYWORDS = new Set([
  'before_visible_sunrise', 'after_visible_sunrise', 'before_visible_sunset', 'after_visible_sunset',
  'before_geometric_sunrise', 'after_geometric_sunrise', 'before_geometric_sunset', 'after_geometric_sunset',
  'before_noon', 'after_noon',
  // Bases
  'gra', 'mga', 'ateret_torah', 'custom',
  'mga_60', 'mga_72', 'mga_90', 'mga_96', 'mga_120',
  'mga_72_zmanis', 'mga_90_zmanis', 'mga_96_zmanis',
  'mga_16_1', 'mga_18', 'mga_19_8', 'mga_26',
  'baal_hatanya',
  // Control flow and boolean
  'if', 'else', 'true', 'false',
  // Condition variables
  'latitude', 'longitude', 'day_length', 'month',
  'day', 'day_of_year', 'date', 'season',
]);

// StreamLanguage tokenizer for DSL
const dslTokenizer = StreamLanguage.define({
  name: 'dsl',

  startState() {
    return { inComment: false };
  },

  token(stream, state) {
    // Skip whitespace
    if (stream.eatSpace()) return null;

    // Comments
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }

    // References (@zman_key)
    if (stream.match(/@[a-zA-Z_][a-zA-Z0-9_]*/)) {
      return 'variableName.special';
    }

    // Duration (e.g., 72min, 1hr, 2.5h)
    if (stream.match(/\d+(?:\.\d+)?\s*(?:min|minutes?|hr|hours?|h|m)\b/i)) {
      return 'unit';
    }

    // Numbers
    if (stream.match(/\d+(?:\.\d+)?/)) {
      return 'number';
    }

    // Operators
    if (stream.match(/[+\-*/<>=!]+/)) {
      return 'operator';
    }

    // Brackets
    if (stream.match(/[(){}[\],]/)) {
      return 'bracket';
    }

    // Identifiers
    if (stream.match(/[a-zA-Z_][a-zA-Z0-9_]*/)) {
      const word = stream.current().toLowerCase();

      if (DSL_FUNCTIONS.has(word)) {
        return 'function';
      }
      if (DSL_PRIMITIVES.has(word)) {
        return 'atom';
      }
      if (DSL_KEYWORDS.has(word)) {
        return 'keyword';
      }
      return 'variableName';
    }

    // Unknown - advance one character
    stream.next();
    return null;
  },
});

// Custom highlight style for DSL tokens - high contrast colors for dark backgrounds
export const dslHighlightStyle = HighlightStyle.define([
  // Functions - vibrant cyan/blue (highly visible)
  { tag: t.function(t.variableName), color: '#22d3ee', fontWeight: '600' },

  // Primitives (atoms) - bright lime green
  { tag: t.atom, color: '#84cc16', fontWeight: '600' },

  // Keywords - bright violet/magenta
  { tag: t.keyword, color: '#c084fc', fontWeight: '500' },

  // Numbers - bright orange/gold
  { tag: t.number, color: '#fbbf24', fontWeight: '600' },

  // Units (duration) - bright pink
  { tag: t.unit, color: '#f472b6', fontWeight: '500' },

  // Operators - white for maximum contrast
  { tag: t.operator, color: '#ffffff', fontWeight: '700' },

  // References (@zman_key) - bright coral/salmon
  { tag: t.special(t.variableName), color: '#fb7185', fontWeight: '600' },

  // Comments - muted gray italic
  { tag: t.comment, color: '#9ca3af', fontStyle: 'italic' },

  // Brackets - light gray
  { tag: t.bracket, color: '#d1d5db' },

  // Unknown identifiers - red to highlight errors
  { tag: t.variableName, color: '#ef4444', fontWeight: '500' },
]);

// Export the language and highlighting
export const dslLanguage = dslTokenizer;
export const dslHighlighting = syntaxHighlighting(dslHighlightStyle);
