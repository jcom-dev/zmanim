/**
 * @file tagNegation.ts
 * @purpose Tag negation eligibility and display state logic
 * @pattern utility-functions
 */

import { ZmanTag } from '@/lib/hooks/useZmanimList';

/**
 * Tag types that support negation (3-state selector)
 * Only event tags can be negated (includes former jewish_day tags)
 * Other types (timing, shita, category) use simple checkboxes
 */
export const NEGATABLE_TAG_TYPES = ['event'] as const;

/**
 * Display states for tag selector
 */
export type TagDisplayState = 'unselected' | 'positive' | 'negated';

/**
 * Determines if a tag can be negated (supports 3-state selector)
 *
 * @param tag - The tag to check
 * @returns true if tag type is event
 */
export function canNegateTag(tag: { tag_type: string }): boolean {
  return NEGATABLE_TAG_TYPES.includes(tag.tag_type as any);
}

/**
 * Gets the display state for a tag based on selection and negation
 *
 * @param tag - The tag with is_negated and selection status
 * @param isSelected - Whether the tag is currently selected
 * @returns The current display state
 */
export function getTagDisplayState(
  tag: { tag_type: string; is_negated?: boolean },
  isSelected: boolean
): TagDisplayState {
  if (!isSelected) {
    return 'unselected';
  }

  // Non-negatable tags can only be positive or unselected
  if (!canNegateTag(tag)) {
    return 'positive';
  }

  // Negatable tags can be positive or negated
  return tag.is_negated ? 'negated' : 'positive';
}

/**
 * Cycles to the next state for a tag selector
 * Non-negatable: unselected → positive → unselected
 * Negatable: unselected → positive → negated → unselected
 *
 * @param tag - The tag to cycle
 * @param currentState - The current display state
 * @returns The next display state
 */
export function getNextTagState(
  tag: { tag_type: string },
  currentState: TagDisplayState
): TagDisplayState {
  const isNegatable = canNegateTag(tag);

  switch (currentState) {
    case 'unselected':
      return 'positive';
    case 'positive':
      return isNegatable ? 'negated' : 'unselected';
    case 'negated':
      return 'unselected';
    default:
      return 'unselected';
  }
}

/**
 * Type guard for ZmanTag with source tracking
 */
export interface ZmanTagWithSource extends ZmanTag {
  tag_source?: 'master' | 'publisher';
  source_is_negated?: boolean | null;
  is_modified?: boolean;
}

/**
 * Checks if a tag has been modified from its source
 *
 * @param tag - Tag with source tracking fields
 * @returns true if tag differs from master registry
 */
export function isTagModified(tag: ZmanTagWithSource): boolean {
  return tag.is_modified === true;
}

/**
 * Gets a human-readable description of tag modification
 *
 * @param tag - Tag with source tracking fields
 * @returns Description of the modification, or null if not modified
 */
export function getTagModificationDescription(tag: ZmanTagWithSource): string | null {
  if (!isTagModified(tag)) {
    return null;
  }

  if (tag.tag_source === 'master' && tag.source_is_negated !== undefined && tag.source_is_negated !== null) {
    const currentState = tag.is_negated ? 'negated' : 'positive';
    const sourceState = tag.source_is_negated ? 'negated' : 'positive';

    if (currentState !== sourceState) {
      return `Changed from ${sourceState} to ${currentState}`;
    }
  }

  return 'Modified from registry';
}
