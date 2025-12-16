'use client';

/**
 * DSLEditor - Premium CodeMirror 6 based editor for Zmanim DSL formulas
 *
 * Features:
 * - Syntax highlighting with custom DSL language support
 * - Smart autocomplete with fuzzy matching
 * - Real-time validation with inline error highlighting
 * - Smooth animations and micro-interactions
 * - Full undo/redo support
 * - Bracket matching
 * - Keyboard shortcuts
 */

export {
  CodeMirrorDSLEditor as DSLEditor,
  type CodeMirrorDSLEditorRef as DSLEditorRef,
} from './CodeMirrorDSLEditor';

export { CodeMirrorDSLEditor as default } from './CodeMirrorDSLEditor';
