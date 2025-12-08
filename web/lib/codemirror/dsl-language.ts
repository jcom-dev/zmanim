/**
 * Custom DSL Language Support for CodeMirror 6
 * Provides syntax highlighting for the Zmanim DSL
 */

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { StreamLanguage } from '@codemirror/language';

// DSL Keywords and tokens
export const DSL_PRIMITIVES = new Set([
  'sunrise', 'sunset', 'solar_noon', 'midnight',
  'civil_dawn', 'civil_dusk', 'nautical_dawn', 'nautical_dusk',
  'astronomical_dawn', 'astronomical_dusk',
  'alos_hashachar', 'misheyakir', 'tzeis_hakochavim', 'bein_hashmashos',
  'chatzos', 'chatzos_hayom', 'chatzos_halailah',
]);

export const DSL_FUNCTIONS = new Set([
  'solar', 'seasonal_solar', 'proportional_hours', 'midpoint', 'min', 'max', 'if',
]);

export const DSL_KEYWORDS = new Set([
  'before_sunrise', 'after_sunrise', 'before_sunset', 'after_sunset',
  'gra', 'mga', 'custom', 'alos_16_1', 'alos_72',
  'else', 'true', 'false',
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
